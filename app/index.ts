import crypto from 'crypto';
import fs from 'fs/promises';
import { exec } from 'child_process';
import dayjs from 'dayjs';
import express from 'express';
import bodyParser from 'body-parser';

const PORT = 6439;

function main() {
  const app = express();
  app.use(bodyParser.json());
  app.post('/api/run', async (req, res) => {
    const lang = req.body.lang ?? 'ts';
    const script = '// @ts-ignore\n' + req.body.script ?? '';
    let config = req.body.config ?? '';
    const timeout = req.body.timeout;
    const uuid = crypto.randomUUID().toString();
    const scriptFileName = `scripts/${uuid}.spec.${lang}`;
    const configFileName = `scripts/${uuid}.config.${lang}`;
    const reportHtmlFileDir = `scripts/${uuid}.report.html`;
    const reportHtmlFileName = `${reportHtmlFileDir}/index.html`;
    config = config.replaceAll("'${perfma_report}'", JSON.stringify([
      ['html', { open: 'never', outputFolder: reportHtmlFileDir.replace('scripts/', '') }],
    ]));
    await Promise.all([
      fs.writeFile(scriptFileName, script, 'utf8'),
      fs.writeFile(configFileName, config, 'utf8'),
    ]);
    const child = exec(`npx playwright test ${scriptFileName} --config ${configFileName}`, async (error, stdout, stderr) => {
      const info: any = { time: dayjs().format('YYYY-MM-DD HH:mm:ss'), uuid, error, stdout, stderr };
      const json = (data: any = { }) => {
        const result = { ...info, ...data };
        console.log({ ...result, object: undefined });
        res.json(result);
      };
      const clean = () => {
        fs.unlink(scriptFileName);
        fs.unlink(configFileName);
        fs.unlink(reportHtmlFileName).then(() => {
          fs.rmdir(reportHtmlFileDir);
        });
      };
      try {
        json({
          success: true,
          object: await fs.readFile(reportHtmlFileName, 'utf8'),
        });
      } catch (error: any) {
        json({ success: false, error });
      }
      clean();
    });
    if (timeout) setTimeout(() => {
      child.kill();
    }, timeout);
  });
  app.listen(PORT, () => {
    console.log(`xen-playwright works on ${PORT} port...`);
  });
}

main();

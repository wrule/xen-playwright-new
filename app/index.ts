import crypto from 'crypto';
import fs from 'fs/promises';
import { exec } from 'child_process';
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
    await Promise.all([fs.writeFile(scriptFileName, script, 'utf8'), fs.writeFile(configFileName, config, 'utf8')]);
    const json = (data: any) => {
      console.log(JSON.stringify({ ...data, object: undefined }, null, 2));
      res.json(data);
    };
    let info: any = { uuid, startTime: Date.now() };
    let timer: any = null;
    const child = exec(`npx playwright test ${scriptFileName} --config ${configFileName}`, async (error, stdout, stderr) => {
      clearTimeout(timer);
      info = { ...info, endTime: Date.now(), error, stdout, stderr, success: !error };
      try {
        info = { ...info, object: await fs.readFile(reportHtmlFileName, 'utf8') };
      } catch (error) {
        info = { ...info, error, success: false };
      }
      info = { ...info, message: info.error?.message };
      json(info);
      fs.unlink(scriptFileName);
      fs.unlink(configFileName);
      fs.unlink(reportHtmlFileName).then(() => fs.rmdir(reportHtmlFileDir));
    });
    if (timeout) timer = setTimeout(() => {
      const message = `timeout ${timeout}ms`;
      json({ ...info, endTime: Date.now(), error: new Error(message), message, success: false });
      child.kill();
    }, timeout);
  });
  app.listen(PORT, () => console.log(`xen-playwright works on ${PORT} port...`));
}

main();

import fsSync from 'fs';
import crypto from 'crypto';
import fs from 'fs/promises';
import { exec } from 'child_process';
import axios from 'axios';
import dayjs from 'dayjs';
import express from 'express';
import bodyParser from 'body-parser';
import compression from 'compression';
import path from 'path';

process.on('uncaughtException', () => { });
process.on('unhandledRejection', () => { });

const PORT = 6429;

function main() {
  const app = express();
  app.use(compression());
  app.use(bodyParser.json());
  app.post('/api/run', async (req, res) => {
    const lang = req.body.lang ?? 'ts';
    const preScripts: string[] = req.body.preScripts ?? [];
    const variables = req.body.variables ?? { };
    const envVariables = req.body.envVariables ?? { };
    const script =
      '// @ts-ignore\n' +
      `
import Sys from '../app/sys';
const sys = new Sys(${JSON.stringify(variables)}, ${JSON.stringify(envVariables)});
      `.trim() + '\n' +
      preScripts.join('\n') + '\n' +
      (req.body.script ?? '') + '\n' +
      `
test.afterAll(() => {
  const fs = require('fs');
  const fileName = __filename
    .replaceAll(__dirname, '')
    .replaceAll('.spec.ts', '')
    .replaceAll('/', '')
    .replaceAll('\\\\', '')
    .replaceAll('.', '');
  fs.writeFileSync('scripts/' + fileName + '.states.json', JSON.stringify(sys.states()), 'utf8');
});
      `.trim() + '\n';

    let config = req.body.config ?? '';
    const timeout = req.body.timeout;
    const uuid = crypto.randomUUID().toString();
    const scriptFileName = `scripts/${uuid}.spec.${lang}`;
    const configFileName = `scripts/${uuid}.config.${lang}`;
    const reportHtmlFileDir = `scripts/${uuid}.report.html`;
    const statesFileName = `scripts/${uuid}.states.json`;
    const reportHtmlFileName = `${reportHtmlFileDir}/index.html`;
    config = config.replaceAll("'${perfma_report}'", JSON.stringify([
      ['html', { open: 'never', outputFolder: reportHtmlFileDir.replace('scripts/', '') }],
    ]));
    await Promise.all([fs.writeFile(scriptFileName, script, 'utf8'), fs.writeFile(configFileName, config, 'utf8')]);
    let finished = false;
    const json = (data: any) => {
      if (finished) return;
      console.log(JSON.stringify({ ...data, object: undefined }, null, 2));
      res.json(data);
      finished = true;
    };
    const now = () => dayjs().format('YYYY-MM-DD HH:mm:ss');
    let info: any = { uuid, startTime: now() };
    let timer: any = null;
    const child = exec(`npx playwright test ${scriptFileName} --config ${configFileName}`, async (error, stdout, stderr) => {
      clearTimeout(timer);
      info = { ...info, endTime: now(), error, stdout, stderr, success: !error };
      try {
        info = { ...info, object: await fs.readFile(reportHtmlFileName, 'utf8'), states: require(path.join('..', statesFileName)) };
      } catch (error) {
        info = { ...info, error, success: false };
      }
      info = { ...info, message: info.error?.message };
      json(info);
      fs.unlink(scriptFileName);
      fs.unlink(configFileName);
      fs.unlink(statesFileName);
      fs.unlink(reportHtmlFileName).then(() => fs.rmdir(reportHtmlFileDir));
    });
    if (timeout) timer = setTimeout(() => {
      const message = `timeout ${timeout}ms`;
      json({ ...info, endTime: now(), error: new Error(message), message, success: false });
      child.kill();
    }, timeout);
  });
  app.listen(PORT, () => console.log(`xen-playwright works on ${PORT} port...`));

  setTimeout(() => {
    axios.post(`http://127.0.0.1:${PORT}/api/run`, {
      lang: 'ts',
      script: fsSync.readFileSync('app/example.spec.ts', 'utf8'),
      config: fsSync.readFileSync('app/playwright.config.ts', 'utf8'),
      preScripts: [`
        const moment = require('moment');
        console.log(moment().format('YYYY-MM-DD HH:mm:ss'));
      `],
      timeout: 5000,
    });
  }, 1000);
}

main();

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

async function allInOneHtml(reportHtmlFileDir: string) {
  const reportHtmlFileName = path.join(reportHtmlFileDir, 'index.html');
  let htmlText = await fs.readFile(reportHtmlFileName, 'utf8');
  htmlText = htmlText.replaceAll('m.jsx(', 'jsxp(m,');
  htmlText = htmlText.replace('<script type="module">', `
<script type="module">
const jsxp = (m, ...args) => {
  const attrs = args[1] ?? { };
  const fileName = attrs.src?.replace('data/', '');
  if (fileName && window[fileName]) attrs.src = window[fileName];
  return m.jsx(...args);
};
`.trim());
  const reportHtmlAssetsDir = path.join(reportHtmlFileDir, 'data');
  let files: string[] = [];
  try {
    files = await fs.readdir(reportHtmlAssetsDir);
  } catch (error) { }
  const buffers = await Promise.all(files.map((file) => fs.readFile(path.join(reportHtmlAssetsDir, file))));
  const dataUrls = buffers.map((buffer, index) => {
    const file = files[index].toLowerCase();
    let base64 = buffer.toString('base64');
    if (file.endsWith('.png')) base64 = `data:image/png;base64,${base64}`;
    else if (file.endsWith('.webm')) base64 = `data:video/webm;base64,${base64}`;
    else base64 = `data:application/octet-stream;base64,${base64}`;
    return base64;
  });
  const varSetCode = dataUrls.map((dataUrls, index) => {
    const file = files[index];
    return `window['${file}'] = '${dataUrls}';`;
  }).join('\n');
  htmlText = htmlText.replace('<script type="module">', `<script type="module">${varSetCode}`);
  return htmlText;
}

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
      `try { Object.entries(window ?? { }).forEach(([key, value]) => global[key] = value); } catch (error) { }` + '\n' +
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
        info = { ...info, object: await allInOneHtml(reportHtmlFileDir), states: require(path.join('..', statesFileName)) };
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
        let window = { };
        window.perfma = 'benma';
      `],
      timeout: 10000,
    });
  }, 1000);
}

main();

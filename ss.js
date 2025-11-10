// == 纯原生 Node.js（Node ≥18）无任何 require ==
const http = require('http');
const crypto = require('crypto');

// ==================== 配置区 ====================
// 通过环境变量传入（推荐）
const UPLOAD_URL = Deno?.env?.get?.('UPLOAD_URL') || '';
const PROJECT_URL = Deno?.env?.get?.('PROJECT_URL') || '';
const AUTO_ACCESS = (Deno?.env?.get?.('AUTO_ACCESS') || 'false') === 'true';
const SUB_PATH = Deno?.env?.get?.('SUB_PATH') || 'sub';
const PORT = Number(Deno?.env?.get?.('SERVER_PORT') || Deno?.env?.get?.('PORT') || '3000');
const UUID = Deno?.env?.get?.('UUID') || '9afd1229-b893-40c1-84dd-51e7ce204913';
const NEZHA_SERVER = Deno?.env?.get?.('NEZHA_SERVER') || '';
const NEZHA_PORT = Deno?.env?.get?.('NEZHA_PORT') || '';
const NEZHA_KEY = Deno?.env?.get?.('NEZHA_KEY') || '';
const ARGO_DOMAIN = Deno?.env?.get?.('ARGO_DOMAIN') || '';
const ARGO_AUTH = Deno?.env?.get?.('ARGO_AUTH') || '';
const ARGO_PORT = Number(Deno?.env?.get?.('ARGO_PORT') || '8001');
const CFIP = Deno?.env?.get?.('CFIP') || 'cdns.doon.eu.org';
const CFPORT = Number(Deno?.env?.get?.('CFPORT') || '443');
const NAME = Deno?.env?.get?.('NAME') || '';

// ==================== 工具函数 ====================
// 随机6位文件名
function randomName() {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  let r = '';
  for (let i = 0; i < 6; i++) r += chars[Math.floor(Math.random() * chars.length)];
  return r;
}

// Base64 编码
function btoa(str) {
  return Buffer.from(str, 'utf-8').toString('base64');
}

// 安全的路径名
function safeName(name) {
  return name.replace(/[^a-zA-Z0-9_-]/g, '');
}

// HTTP POST 原生实现
async function postJSON(url, data) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.ok ? await res.json().catch(() => ({})) : null;
  } catch {
    return null;
  }
}

// 获取本机 IP 信息（替代 curl）
async function getISP() {
  try {
    const res = await fetch('https://speed.cloudflare.com/meta');
    const text = await res.text();
    const match = text.match(/"asn":([^,]+),"colocation":([^,]+),/);
    if (match) {
      return `${match[1].trim()}-${match[2].trim()}`.replace(/ /g, '_');
    }
  } catch {}
  return 'Unknown';
}

// ==================== 核心逻辑 ====================
let argoDomain = ARGO_DOMAIN || 'temp.trycloudflare.com'; // 临时占位

// 生成订阅内容
async function generateSubContent() {
  const isp = await getISP();
  const nodeName = NAME ? `${NAME}-${isp}` : isp;

  const vless = `vless://${UUID}@${CFIP}:${CFPORT}?encryption=none&security=tls&sni=${argoDomain}&fp=firefox&type=ws&host=${argoDomain}&path=%2Fvless-argo%3Fed%3D2560#${nodeName}`;
  const vmessObj = {
    v: '2', ps: nodeName, add: CFIP, port: CFPORT, id: UUID, aid: '0',
    scy: 'none', net: 'ws', type: 'none', host: argoDomain,
    path: '/vmess-argo?ed=2560', tls: 'tls', sni: argoDomain, fp: 'firefox'
  };
  const vmess = `vmess://${btoa(JSON.stringify(vmessObj))}`;
  const trojan = `trojan://${UUID}@${CFIP}:${CFPORT}?security=tls&sni=${argoDomain}&fp=firefox&type=ws&host=${argoDomain}&path=%2Ftrojan-argo%3Fed%3D2560#${nodeName}`;

  const content = `${vless}\n\n${vmess}\n\n${trojan}\n`;
  const encoded = btoa(content);

  console.log('=== 订阅内容 Base64 ===');
  console.log(encoded);
  console.log('======================');

  return { content, encoded };
}

// 上传节点或订阅
async function uploadData(encoded) {
  if (!UPLOAD_URL) return console.log('UPLOAD_URL 未设置，跳过上传');

  if (PROJECT_URL) {
    const subUrl = `${PROJECT_URL}/${SUB_PATH}`;
    await postJSON(`${UPLOAD_URL}/api/add-subscriptions`, { subscription: [subUrl] });
    console.log('订阅上传成功');
  } else {
    // 模拟节点上传（无 list.txt 则跳过）
    console.log('仅支持订阅上传（无节点文件）');
  }
}

// 自动访问保活
async function autoAccess() {
  if (!AUTO_ACCESS || !PROJECT_URL) return;
  await postJSON('https://oooo.serv00.net/add-url', { url: PROJECT_URL });
  console.log('保活任务添加成功');
}

// ==================== 主服务 ====================
const server = http.createServer(async (req, res) => {
  const url = req.url || '/';

  // 根路径
  if (url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Hello world!');
    return;
  }

  // 订阅路径
  if (url === `/${SUB_PATH}`) {
    const { encoded } = await generateSubContent();
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(encoded);
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

// ==================== 启动流程 ====================
async function start() {
  console.log('正在启动服务...');

  // 1. 生成订阅内容（可提前）
  const subData = await generateSubContent();

  // 2. 上传
  await uploadData(subData.encoded);

  // 3. 保活
  await autoAccess();

  // 4. 启动 HTTP 服务
  server.listen(PORT, () => {
    console.log(`HTTP 订阅服务器运行在 :${PORT}`);
    console.log(`订阅链接: http://localhost:${PORT}/${SUB_PATH}`);
  });

  // 5. Argo 域名处理（仅日志提示）
  if (ARGO_DOMAIN) {
    console.log(`固定 Argo 域名: ${ARGO_DOMAIN}`);
  } else {
    console.log('警告：未配置 ARGO_DOMAIN，使用临时隧道需配合外部 bot');
  }
}

// ==================== 启动 ====================
start().catch(err => {
  console.error('启动失败:', err);
});

// 90秒后清理（仅日志）
setTimeout(() => {
  console.clear();
  console.log('App is running');
  console.log('Thank you for using this script, enjoy!');
}, 90000);

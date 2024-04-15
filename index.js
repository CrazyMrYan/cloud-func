const Koa = require('koa');
const Router = require('koa-router');
const bodyParser = require('koa-bodyparser');
const vm = require('vm');
const fs = require('fs');
const { execSync } = require('child_process');
const acorn = require('acorn');
const walk = require('acorn-walk');

const app = new Koa();
const router = new Router();

app.use(bodyParser());

router.post('/run-script', async (ctx) => {
  const { scriptPath } = ctx.request.body;

  try {
    // 读取文件
    const code = fs.readFileSync(scriptPath, 'utf8');

    // 解析AST
    const ast = acorn.parse(code, { ecmaVersion: 2020 });
    const modules = new Set();

    // 遍历AST，寻找所有require调用
    walk.simple(ast, {
      CallExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'require' &&
            node.arguments.length > 0 && node.arguments[0].type === 'Literal') {
          modules.add(node.arguments[0].value);
        }
      }
    });

    // 安装模块
    for (let mod of modules) {
      execSync(`yarn add ${mod}`);
    }

    // 创建沙箱环境
    const sandbox = {
      console: console,
      require: require,
    };

    // 引入模块到沙箱
    modules.forEach(mod => {
      sandbox[mod] = require(mod);
    });

    // 在沙箱中运行代码
    const script = new vm.Script(code);
    script.runInNewContext(sandbox);

    ctx.status = 200;
    ctx.body = 'Script executed successfully.';
  } catch (error) {
    ctx.status = 500;
    ctx.body = `Error executing script: ${error.message}`;
  }
});

app.use(router.routes()).use(router.allowedMethods());

const port = 3001;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

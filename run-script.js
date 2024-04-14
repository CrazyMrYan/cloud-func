const vm = require('vm');
const fs = require('fs');
const { execSync } = require('child_process');
const acorn = require('acorn');
const walk = require('acorn-walk');

const scriptPath = process.argv[2];
const code = fs.readFileSync(scriptPath, 'utf8');

const ast = acorn.parse(code, { ecmaVersion: 2020 });
const modules = new Set();

// 遍历 AST 树，收集所有 require() 调用的模块名称
walk.simple(ast, {
  CallExpression(node) {
    if (node.callee.type === 'Identifier' && node.callee.name === 'require' &&
        node.arguments.length > 0 && node.arguments[0].type === 'Literal') {
      modules.add(node.arguments[0].value);
    }
  }
});

// 安装每个模块
modules.forEach(mod => {
  try {
    execSync(`npm install ${mod}`);
  } catch (error) {
    process.send({ message: `Error installing module ${mod}: ${error.message}` });
    process.exit();
  }
});

// 创建沙箱环境并运行脚本
try {
  const sandbox = { console };
  modules.forEach(mod => {
    sandbox[mod] = require(mod);
  });

  const script = new vm.Script(code);
  script.runInNewContext(sandbox);
  process.send({ message: 'Script executed successfully.' });
} catch (error) {
  process.send({ message: `Error executing script: ${error.message}` });
}

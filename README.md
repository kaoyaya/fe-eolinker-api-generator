eolinker接口api代码生成
查看test/test.js 


// 生成的xhr
```js
function createEntity({ name, stock, cost, categoryID, storehose }) {
  return xhr({
    method: 'post',
    headers:{"Content-Type":"multipart/form-data"},
    url: `/api/order/entity/create`,
    data: { name, stock, cost, categoryID, storehose },
    custom:arguments[1] // 自定义参数
  })
}
```

readline-sync必须要在terminal或者shell中run api
不然会报无法监听TYY的错误

```
手写实现存在异步问题
// function tipsToContinue() {
//   const rl = readline.createInterface({
//     input: process.stdin,
//     output: process.stdout,
//   });
//   showTip = false;
//   rl.question('当前代码中含有要使用nuxtMode模式生成的接口，是否继续?(Y/N)', function (answer) {
//     if (answer.toLowerCase() === 'y') {
//       rl.close();
//     } else if (answer.toLowerCase() === 'n') {
//       process.exit(0);
//     }
//   });
//   // close事件监听,不加close，则不会结束
//   rl.on('close', function () {
//     // 结束程序
//     process.exit(1);
//   });
// }
```
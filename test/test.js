const gene = require('../index');
const path = require('path');


gene({
  /**
   * 可选参数 rest normal, 当为 rest参数时，需要在api说明中使用 `-`分割函数名，
   * 比如：`获取用户信息-getUserInfo`， 将使用 `getUserInfo`当做函数名称
   */
  apiType: 'normal',
  // entry 接口数据文件
  entry: path.resolve(__dirname, './user.json'),
  // 生成的 class  名称
  className: 'normal',
  // 导入的头部模板
  importHead: `import xhr from  './xhr/xhr'`,
  // 生成文件的路径
  outputPath: path.resolve(__dirname, '../dist'),
  // 生成文件名称
  outputFileName: 'userSrv',
  // 文件扩展名，默认为 `js`
  outputExtname: 'js',
  // 是否使用覆盖源文件的方式生成
  overwrite: true,
  // post 方法是否使用json,默认为 false,使用formData
  globalPostJson: true,
});

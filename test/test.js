const gene = require('../index');
const path = require('path');
/**
 * 请先确保将api的状态改为启用或者对接,其他状态的api不会生成
 */
gene({
  /**
   * 可选参数 rest normal, 当为 rest参数时，需要在api说明中使用 `-`分割函数名，
   * 比如：`获取用户信息-getUserInfo`， 将使用 `getUserInfo`当做函数名称
   */
  apiType: 'rest',
  // entry 接口数据文件
  entry: path.resolve(__dirname, './user.json'),
  // 生成的 class  名称
  className: 'QaSrv',
  // 导入的头部模板
  importHead: `import xhr from  './xhr/xhr'`,
  // 生成文件的路径
  outputPath: path.resolve(__dirname, '../dist'),
  // 生成文件名称
  outputFileName: 'aaa',
  // 文件扩展名，默认为 `js`
  outputExtname: 'ts',
  // 是否使用覆盖源文件的方式生成
  overwrite: true,
  // post 方法是否使用json,默认为 false,使用formData
  globalPostJson: false,
  // 是否是nuxt模式,nuxt模式会在生成接口的基础上额外传入一个context参数
  isNuxtMode: true,
});


const fs = require('fs');
const path = require('path');
const pathToRegexp = require('path-to-regexp');
const mkdirp = require('mkdirp');

const apiRequestType = {
  POST: 0,
  GET: 1,
  PUT: 2,
  DELETE: 3,
  HEAD: 4,
  OPTIONS: 5,
  PATCH: 6,
};
const paramsType = {
  0: 'string',
  1: 'file',
  2: 'json',
  3: 'int',
  4: 'float',
  5: 'double',
  6: 'date',
  7: 'datetime',
  8: 'boolean',
  9: 'byte',
  10: 'short',
  11: 'long',
  12: 'array',
  13: 'object',
  14: 'number',
};

const apiStatus = {
  0: '启动',
  1: '维护',
  2: '弃用',
  3: '待定',
  4: '开发',
  5: '测试',
  6: '对接',
  7: 'BUG',
};

const API_TYPE = {
  normal: 'normal',
  rest: 'rest',
};

const defaultConfig = {
  apiType: 'rest',
  overwrite: true,
  importHead: `import xhr from '../xhr/microXhr';`,
  outputExtname: `js`,
};

function apiFilter(api) {
  return [0, 6].includes(api.baseInfo.apiStatus);
}

function isPostJson(headerInfo) {
  return headerInfo.some(head => {
    return head.headerName === 'Content-Type' && head.headerValue === 'application/json';
  });
}

function geneParam(params) {
  if (!params.length) return null;
  return params.map(item => item.paramKey).join(', ');
}

function geneComment({commentName, funcParams}) {
  let str = '';
  funcParams.forEach((item, i) => {
    str += `   * @param { ${paramsType[+item.paramType]} } ${item.paramKey} - ${item.paramName}${i !== funcParams.length - 1 ? '\n' : ''}`;
  });
  if (str) {
    str = `\n${str}`;
  }
  const tpl = `
   /**
   * ${commentName}${str}
   * @return {Promise<any>}
   */`;
  return tpl;
}

function baseGeneXhr({
                       type, url, funcParams, params, funcName, commentName, isPostJson, headers,
                     }) {
  let tpl = '';
  let funcPa = geneParam(funcParams);
  let dataPa = geneParam(params);
  
  //当为get方法时 去除链接中的query参数
  if (type==apiRequestType.GET){
    const idx = url.indexOf("?")
    if (idx > 0) {
      url = url.substring(0, idx)
    }
  }

  funcPa = funcPa ? `{ ${funcPa} }` : '';
  dataPa = dataPa ? `{ ${dataPa} }` : '';
  const headerStr = Object.values(headers).length ? JSON.stringify(headers) : '';
  const comment = geneComment({commentName, funcParams});
  type = Number(type)
  if (type === apiRequestType.POST) {
    tpl = `
  ${comment}
  static ${funcName}(${funcPa}) {
    return xhr({
      method: 'post',${headerStr ? `\n      headers:${headerStr},` : ''}
      url: \`${url}\`,${isPostJson ? '' : '\n      json: false,'}
      data: ${dataPa || '{}'},
      custom: arguments[1]
    })
  }`;
  } else if (type === apiRequestType.GET) {
    tpl = `
  ${comment}  
  static ${funcName}(${funcPa}) {
    return xhr({
      url: \`${url}\`,${headerStr ? `\n      headers:${headerStr},` : ''}
      params: ${dataPa || '{}'},
      custom: arguments[1]
    })
  }`;
  }
  return tpl;
}

function normalGeneXhr({type, uri, params, apiName, isPostJson, headers}) {
  const name = uri.substr(uri.lastIndexOf('/') + 1);
  return baseGeneXhr({
    type,
    url: uri,
    funcParams: params,
    headers,
    params,
    commentName: apiName,
    funcName: name,
    isPostJson,
  });
}

function restGeneXhr({type, uri, params, apiName, isPostJson, headers}) {
  const nameArray = apiName.split('-');
  if (nameArray.length <= 1) {
    throw new Error(`${apiName} 没有函数名称，需要以 '-' 分割 `);
  }

  const commentName = nameArray[0];
  const funcName = nameArray[nameArray.length - 1];

  let pathParamKeys = [];
  pathToRegexp(uri, pathParamKeys);
  const toPath = pathToRegexp.compile(uri);
  const urlPathKeys = {};
  pathParamKeys.forEach(item => {
    urlPathKeys[item.name] = `$\{${item.name}\}`;
  });
  // 请求路径
  const url = toPath(urlPathKeys, {encode: (value, token) => value});
  const pathParamKeysList = pathParamKeys.map(item => item.name);
  const paramList = params.filter(item => {
    return !pathParamKeysList.includes(item.paramKey);
  });
  return baseGeneXhr({
    type,
    url,
    funcParams: params,
    params: paramList,
    commentName,
    funcName,
    isPostJson,
    headers,
  });
}

/*
eg:
[ { headerName: 'Content-Type',
  headerValue: 'multipart/form-data' } ]
  ={
  'Content-Type':'multipart/form-data'
  }
  */

function headersToObject(headres) {
  const obj = {};
  headres.forEach((item) => {
    obj[item.headerName] = item.headerValue;
  });
  return obj;
}


/**
 * @param entry - 文件路径
 * @param output - 生成的文件名
 * @param {Function} geneXhr - 生成函数
 * @param overwrite - 是否覆盖生成的文件
 */
function geneApi(
  {
    entry,
    geneXhr,
    outputFileName,
    outputPath,
    overwrite = defaultConfig.overwrite,
    className,
    importHead = defaultConfig.importHead,
    outputExtname = defaultConfig.outputExtname,
    globalPostJson = false,
    singlePostJsonFilter = isPostJson,
  }) {
  const outputFile = outputFileName || path.parse(entry).name;
  const exist = fs.existsSync(`./${outputFile}.js`);
  if (!overwrite) {
    if (exist) throw new Error(`${outputFile}.js 已存在`);
  }
  fs.readFile(entry, (err, data) => {
    if (err) throw err;
    const apiList = JSON.parse(data.toString());
    let strs = '';
    apiList.filter(apiFilter).forEach((item) => {
      const {baseInfo, headerInfo, requestInfo, restfulParam, urlParam} = item;
      const {apiName, apiURI, apiRequestType} = baseInfo;
      const str = geneXhr({
        apiName,
        type: apiRequestType,
        uri: apiURI,
        isPostJson: singlePostJsonFilter(headerInfo) || globalPostJson,
        params: [...requestInfo, ...restfulParam || [], ...urlParam].filter(item => !item.paramKey.includes('>>')),
        headers: headersToObject(headerInfo),
      });
      strs += str;
    });
    mkdirp.sync(outputPath, (err) => {
      if (err) throw err;
      console.log(123);
    });
    fs.writeFileSync(`${outputPath}/${outputFile}.${outputExtname}`, `
${importHead}

export default class ${className}{
  ${strs}
}`);
  });
}

module.exports = function (config) {
  Object.assign(defaultConfig, config);
  config.geneXhr = config.apiType === API_TYPE.rest ? restGeneXhr : normalGeneXhr;
  return geneApi(config);
};

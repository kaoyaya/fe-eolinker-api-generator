const fs = require('fs');
const path = require('path');
const pathToRegexp = require('path-to-regexp');
const mkdirp = require('mkdirp');
const readline = require('readline');
var readlineSync = require('readline-sync');

let showTip = true;

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
    nuxt: 'nuxt',
};


const defaultConfig = {
    apiType: 'rest',
    overwrite: true,
    importHead: `import xhr from '../xhr/microXhr';`,
    outputExtname: `js`,
};

process.on('exit', function (code) {
    console.log('状态码:', code);
    if (code !== 101) {
        console.log('\n', '接口生成完毕', '\n');
    } else {
        console.log('\n', '接口生成中断', '\n');
    }
});

function apiFilter(api) {
    return [0, 6].includes(parseInt(api.baseInfo.apiStatus));
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
                         apiType, type, url, funcParams, params, funcName, commentName, isPostJson, headers,
                     }) {
    let tpl = '';
    let funcPa = geneParam(funcParams);
    let dataPa = geneParam(params);

    //当为get方法时 去除链接中的query参数
    if (type == apiRequestType.GET) {
        const idx = url.indexOf('?');
        if (idx > 0) {
            url = url.substring(0, idx);
        }
    }

    dataPa = dataPa ? `{ ${dataPa} }` : '{}';
    //当header中包含{"Content-Type": "multipart/form-data"}时 创建一个formData对象来替换data
    let multpartFormDataStr = ''
    if (type == apiRequestType.POST && dataPa != '{}' && headers.hasOwnProperty('Content-Type') && headers['Content-Type'] === 'multipart/form-data') {
        multpartFormDataStr = generatorMultipart(dataPa)
        dataPa = 'formData'
    }

    funcPa = funcPa ? `{ ${funcPa} }` : '';
    const headerStr = Object.values(headers).length ? JSON.stringify(headers) : '';
    const comment = geneComment({commentName, funcParams});
    type = Number(type);
    if (type === apiRequestType.POST) {
        tpl = generatorPostTpl(apiType, comment, funcName, funcPa, url, headerStr, dataPa, multpartFormDataStr,isPostJson);
    } else if (type === apiRequestType.GET) {
        tpl = generatorGetTpl(apiType, comment, funcName, funcPa, url, headerStr, dataPa)
    }
    return tpl;
}

function generatorMultipart(dataPa) {
    return `\n
    const formData = new FormData();
    const data = ${dataPa}
    Object.keys(data).forEach((key) => {
      formData.append(key, data[key]);
    });`
}

function generatorPostTpl(apiType, comment, funcName, funcPa, url, headerStr, dataPa, multpartFormDataStr,isPostJson) {
    if (apiType === API_TYPE.nuxt) {
        return `
   ${comment}
   ${funcName}(${funcPa}) { ${multpartFormDataStr}
      return $axios({
          method: 'post',${headerStr ? `\n      headers:${headerStr},` : ''}
          url: \`${url}\`,${isPostJson ? '' : '\n      json: false,'}
          data: ${dataPa},
          custom: arguments[1]
      })
    },`;
    } else {
        return`${comment}
  static ${funcName}(${funcPa}) { ${multpartFormDataStr}
    return xhr({
      method: 'post',${headerStr ? `\n      headers:${headerStr},` : ''}
      url: \`${url}\`,${isPostJson ? '' : '\n      json: false,'}
      data: ${dataPa},
      custom: arguments[1]
    })
  }`;
    }
}

function generatorGetTpl(apiType, comment, funcName, funcPa, url, headerStr, dataPa) {
    if (apiType === API_TYPE.nuxt) {
        return `
  ${comment}
  ${funcName}(${funcPa}) {
    return $axios({
      url: \`${url}\`,${headerStr ? `\n      headers:${headerStr},` : ''}
      params: ${dataPa || '{}'},
      custom: arguments[1]
    })
  },`;
    } else {
        return `
  ${comment}
  static ${funcName}(${funcPa}) {
    return xhr({
      url: \`${url}\`,${headerStr ? `\n      headers:${headerStr},` : ''}
      params: ${dataPa || '{}'},
      custom: arguments[1]
    })
  }`;

    }

}


function getPathUri(url, type) {
    //当为get方法时 去除链接中的query参数
    if (type == apiRequestType.GET) {
        const idx = url.indexOf('?');
        if (idx > 0) {
            url = url.substring(0, idx);
        }
    }
    return url;

}


function normalGeneXhr({type, uri, params, apiName, isPostJson, headers}) {
    uri = getPathUri(uri, type);
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

function restGeneXhr({apiType, type, uri, params, apiName, isPostJson, headers}) {
    uri = getPathUri(uri, type);
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
        apiType,
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

function nuxtGeneXhr({apiType, type, uri, params, apiName, isPostJson, headers}) {
    uri = getPathUri(uri, type);
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
        apiType,
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
        apiType,
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
        let apiList = JSON.parse(data.toString());
        let strs = '';
        apiList = apiList['apiList'] || apiList
        apiList.filter(apiFilter).forEach((item) => {//json内容
            const {baseInfo, headerInfo, requestInfo, restfulParam, urlParam} = item;

            const {apiName, apiURI, apiRequestType} = baseInfo;
            const str = geneXhr({
                apiType,
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
        });

        fs.writeFileSync(`${outputPath}/${outputFile}.${outputExtname}`, getFileContent({
            apiType,
            importHead,
            className,
            strs
        }));
    });
}

module.exports = function (config) {
    Object.assign(defaultConfig, config);
    switch (config.apiType) {
        case API_TYPE.rest:
            config.geneXhr = restGeneXhr
            break;
        case API_TYPE.normal:
            config.geneXhr = normalGeneXhr
            break;
        case API_TYPE.nuxt:
            config.geneXhr = nuxtGeneXhr
            break;
        default:
            config.geneXhr = normalGeneXhr
            break;
    }
    return geneApi(config);
};


function getFileContent({apiType, importHead, className, strs}) {
    if (apiType === API_TYPE.nuxt) {
        return `
export default function ${className}($axios){
  return {
       ${strs}
  }
}`
    } else {
        return `
${importHead}

export default class ${className}{
    ${strs}
}`
    }
}

!function(root){
    let paths = {},
        bazeURL = '',
        definedMod = {},
        loadedMod = {},
        globalDefQueue = [],
        init = false,
        _current = '',
        _head = document.getElementsByTagName('head')[0],
        _BAZE_URL = /^https?:\/\/.+?\/|^file:\/\/.+?\/|^\/.*?\//,
        _URL_DIR = /[^/]*$/
        _DOT_RE = /\/\.\//g,
		_DOUBLE_DOT_RE = /\/[^/]+\/\.\.\//,
        _DOUBLE_SLASH_RE = /([^:/])\/\//g;
    /** 工具类
     * 
     */
    const Tools = {
        /** 基本处理工具
         * 
         */
        _isString: function(f) {
            return !!f && ( Object.prototype.toString.call(f) === "[object String]" || typeof f === "string" )
        },
        _isArray: function(f) {
            return !!f &&  Object.prototype.toString.call(f) === "[object Array]" 
        },
        _isFunction: function(f) {
            return !!f && ( Object.prototype.toString.call(f) === "[object Function]" || typeof f === "function" )
        },
        /** URL路径处理工具
         * 
         */
        
        _normalize: function(base, id){
            //如果有匹配到配置, 返回配置的路径
            if(paths[id]) return paths[id];
            //判断是否给定网址或者文件路径
            if (Tools._isUnnormalId(id)) return id;
            //拼接路径
            if (Tools._isRelativePath(id)) return Tools._resolvePath(base, id) + '.js';
            return id;
        },
    
        _isUnnormalId: function(id) {
            return (/^https?:|^file:|^\/|\.js$/).test(id);
        },
    
        _isRelativePath: function(path) {
            return (path + '').indexOf('.') === 0;
        },
    
        // reference from seajs
        _resolvePath: function(base, path) {
            path = base.substring(0, base.lastIndexOf('/') + 1) + path;
            path = path.replace(_DOT_RE, '/');
            while (path.match(_DOUBLE_DOT_RE)) {
                path = path.replace(_DOUBLE_DOT_RE, '/');
            }
            return path = path.replace(_DOUBLE_DOT_RE, '$1/');
        },
        /** 获取当前URL路径, 用于设置bazeURL
         * 
         */
        _getCurrentScript: function() {
            //取得正在解析的script节点
            if(document.currentScript) { //firefox 4+
                return document.currentScript.src;
            }
            // 参考 https://github.com/samyk/jiagra/blob/master/jiagra.js
            var stack;
            try {
                a.b.c(); //强制报错,以便捕获e.stack
            } catch(e) {//safari的错误对象只有line,sourceId,sourceURL
                stack = e.stack;
                if(!stack && window.opera){
                    //opera 9没有e.stack,但有e.Backtrace,但不能直接取得,需要对e对象转字符串进行抽取
                    stack = (String(e).match(/of linked script \S+/g) || []).join(" ");
                }
            }
            if(stack) {
                /**e.stack最后一行在所有支持的浏览器大致如下:
                *chrome23:
                * at http://113.93.50.63/data.js:4:1
                *firefox17:
                *@http://113.93.50.63/query.js:4
                *opera12:
                *@http://113.93.50.63/data.js:4
                *IE10:
                *  at Global code (http://113.93.50.63/data.js:4:1)
                */
                stack = stack.split( /[@ ]/g).pop();//取得最后一行,最后一个空格或@之后的部分
                stack = stack[0] == "(" ? stack.slice(1,-1) : stack;
                return stack.replace(/(:\d+)?:\d+$/i, "");//去掉行号与或许存在的出错字符起始位置
            }
            var nodes = document.getElementsByTagName("script"); //只在document标签中寻找
            for(var i = 0, node; node = nodes[i++];) {
                if(node.readyState === "interactive") {
                    return node.className = node.src;
                }
            }
        },
        
        _getUrlDir: function(url){
            return url.replace(_URL_DIR, '')
        },

        _getBazeUrl: function(url){
            return url.match(_BAZE_URL)[0]
        }

    }

    let LoadingMod = function() {
        let map = []
        return {
            Get: function(module){
                //判断是否已经在paths里配置, 如果没有就组装module
                let m = map.filter(function(m){
                    return m.module == module.module
                })
                return m.length ? m : false

            },
            Set: function(config){
                map.push(config)
                return true
            },
            Delete: function(module){
                for(let i = map.length - 1; i > -1; i--){
                    if(Tools._isString(module.module) && map[i].module == module.module 
                    && Tools._isArray(module.deps) && map[i].deps.join() == module.deps.join()
                    && (Tools._isFunction(module.cb) || Tools._isString(module.cb)) 
                    && map[i].cb.toString() == module.cb.toString()){
                        map.splice(i, 1)
                    }
                }
            },
            forEach: function(fn){
                map.forEach(function(m){
                    fn.call(root, m)
                })
            }
        }
    }()

    let moduleFactory = function(){
        return {
            breakCycle: function(module, traced={}, cycle = false){
                if(traced[module]){
                    cycle = true
                    return cycle
                }
                LoadingMod.forEach(function(loading){
                    let ds = loading.deps
                    if(!cycle){
                        for(let i = ds.length - 1; i > -1; i--){
                            if(ds[i] == module){
                                if(traced[loading.module]){
                                    cycle = true
                                } else {
                                    if(moduleFactory.breakCycle(loading.module, traced, cycle)){
                                        cycle = true
                                    }
                                }
                                break
                            }
                        }
                    }
                    if(cycle){
                        return cycle
                    }
                })
                return cycle
            },
            make : function(){
                if(!globalDefQueue.length){
                    LoadingMod.forEach(function(module){
                        module.deps.forEach(function(d, i){
                            if(d == paths['jquery'] && !!root.$){
                                module.depsExports[i] = $
                                module.depsCount --
                                moduleFactory.check(module)
                            }
                        })

                    })
                }
                for(let i = globalDefQueue.length - 1; i > -1; i--){
                    //判断是否有exports, 如果有直接返回, 没有的话将cb压入线程末端, 迭代依赖数组
                    let loading = globalDefQueue.shift(), //从队列里剪切模块信息出来, 进行处理
                    deps = Array.prototype.slice.call(loading.deps),
                    depsCount = deps.length,
                    depsExports = [],
                    path = '', //储存依赖对应的实际路径
                    m = {}, //储存依赖对应的模块信息
                    mod = {}
                    //注册该模块
                    definedMod[loading.module] = true
                    //迭代依赖数组, 将路径转化为实际路径
                    deps = deps.map(function(dep, j){
                        path = Tools._normalize(loading.module, dep)
                        m = definedMod[path]
                        //判断是否已经注册过
                        //如果还没有注册过, 就注册该模块并加载
                        if(! m){
                            //将路径载入队列, 表示已经加载过
                            definedMod[path] = true
                            setTimeout(function(){moduleFactory.load({path})}, 4)
                        } else {
                            let traced = {}, cycle = false
                            traced[path] = true
                            if(moduleFactory.breakCycle(loading.module,traced,cycle)){
                                throw new Error('cycle dependency')
                            }
                            if(loadedMod[path]){
                                //如果已经加载完, 把依赖模块的回调信息加载至主模块
                                depsExports[j] = loadedMod[path].exports
                                depsCount --
                            }
                        }
                        return path
                    })
                    mod = {
                        module: loading.module,
                        deps: deps,
                        cb: loading.cb,
                        depsExports: depsExports,
                        exports:null,
                        parentMod: null,
                        depsCount: depsCount
                    }
                    LoadingMod.Set(mod)
                    moduleFactory.check(mod)
                }

            },
            load : function(config){
                let node = document.createElement("script")
                node.src = config.path
                node.async = true
                node.addEventListener("load", _load, false)
                _head.appendChild(node)
                function _load(){
                    _end();
                    return moduleFactory.make(config.path);
                }
                function _end(){
                    node.removeEventListener("load", _load, false)
                }
            },
            /**
             * 传入模块信息, 判断当前模块的依赖模块数组是否已经加载完了, 如果加载完了立即调用对应回调, 取出回调结果
             * 把全局调用了该依赖的父模块进行依赖更新, 把正在加载模块信息删除, 并注册已经加载完的模块
             */
            check : function(module){
                    //如果当前模块的依赖都加载完了
                    if(module.depsCount < 1){
                        //执行当前模块的回调, 并写入模块
                        if(Tools._isFunction(module.cb)){
                            module.exports = module.cb.apply(root, module.depsExports)
                        } else {
                            module.exports = module.cb
                        }
                        //将当前模块注册至已加载完模块, 并把正在加载模块信息删除
                        loadedMod[module.module] = {module:module.module, exports:module.exports}
                        LoadingMod.Delete({module:module.module, deps:module.deps, cb:module.cb})
                        //循环所有模块, 只要当前模块的子依赖了module, 就把依赖计数-1, 记录该模块的依赖导出
                        LoadingMod.forEach(function(loading){
                            //依赖更新
                            let depsMod = Array.prototype.slice.call(loading.deps)
                            for(let j = 0; j < depsMod.length; j++){
                                if(depsMod[j] == module.module){
                                    loading.depsCount -- 
                                    loading.depsExports[j] = module.exports
                                    //检查父模块的依赖
                                    moduleFactory.check(loading)
                                    break;
                                }
                            }
                        })
                    }
            }
        }
    }()
    /**
     * 注册主模块信息, 如果依赖模块数组没有注册, 进行注册并加载
     * @param {*依赖模块数组} deps 
     * @param {*回调函数} cb 
     */
    function makeRequire(deps, cb){
        let inputs = [], path = '', module, depsExports = [], depsCount = 0
        //初始化基准路径
        deps = Array.prototype.slice.call(deps)
        depsCount = deps.length
        _current = Tools._getCurrentScript()
        if(!bazeURL){
            bazeURL = Tools._getBazeUrl(_current)
        }
        //初始化deps依赖数组
        deps = deps.map(function(dep){
            return Tools._normalize(bazeURL, dep)
        })
        //查看是否已经define执行了该模块
        //如果还没注册过该模块, 就初始化该模块
        globalDefQueue.unshift({module:_current, deps:deps, cb: cb})
        moduleFactory.make()
    }
    function config(config){
        let p = config.paths 
        for(let k in p){
            if(!/.js$/.test(p[k])){
                p[k] += '.js'
            }
        }
        Object.assign(paths, p)
    }
    /**
     * 
     * @param {*模块名称} module 
     * @param {*依赖数组} deps 
     * @param {*回调} cb 
     */
    function define(module, deps, cb) {
        //逐个参数进行判断, 进入相对应的分支
        let current = Tools._getCurrentScript(), m, path
		//匿名模块
		if(! Tools._isString(module) ){
			cb = deps
			deps = module
			module = null
		}
		//无依赖模块
		if(! Tools._isArray(deps) ){
			cb = deps
			deps = []
        }
        //匿名并且无依赖, 直接返回exports的情况
        if(! Tools._isFunction(cb)){
            cb = module
            module = null
        }
        //读取对应路径的JS文件,将其依赖和回调存至缓存
        //如果是具名模块,则将ID录入paths配置里, 否则就注册当前地址为module
        if(module){
            paths[module] = current
        } else {
            module = current
        }
        //判断是否全局有开始加载过模块, 没有的话添加至Modules, 避免重复创建script标签
        path = Tools._normalize(current, module)
        globalDefQueue.unshift({module:path, deps:deps, cb:cb})

    }
    /**
     * 初始化方法, 加载main.js
     */
    !function(){
        if(!init){
            init = true
            var current = Tools._getCurrentScript()
            //获取basepath
            //入口函数所在的js文件
            var nodes = document.getElementsByTagName("Script");
            var node = nodes[nodes.length - 1];	
            var mainjs = node.getAttribute('data-main'); 
            //首先加载入口js文件并执行
            var _now = Tools._normalize(current, mainjs)
            moduleFactory.load({path:_now})
        }
    }()
    root.require = makeRequire
    root.require.config = config
    root.define = define
}(window)
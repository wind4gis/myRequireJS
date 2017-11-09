const assert = require('assert')

describe('require', () => {
  before(() => {
    require.config({
      paths: {
        'jquery': 'https://cdn.bootcss.com/jquery/2.2.1/jquery',
      }
    })
  })

  it('可以异步require代码', function (done) {
    require(['./base/mod/a'], function (mod) {
      mod.should.equal('hello world')
      done()
    })
  })

  it('加载模块可以有依赖', function (done) {
    require(['./base/mod/b'], function (mod) {
      mod.should.equal('Wind: hello world')
      done()
    })
  })

  it('可以设置paths', function (done) {
    require(['jquery'], function ($) {
      $('body').length.should.equal(1)
      done()
    })
  })

  it('重复依赖', function () {
      require(['./base/mod/c'],function(mod){
        should.throws(()=>{mod})
        done()
      })
  })
})
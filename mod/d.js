define(['./e'], function (e) {
  return `Cyclic dependency:c=>d=>e=>c ${e}`
})
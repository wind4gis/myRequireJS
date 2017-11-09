define(['./c'], function (c) {
  return `Cyclic dependency:c=>d=>e=>c ${c}`
})
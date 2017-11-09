define(['./d'], function (d) {
  return `Cyclic dependency:c=>d=>e=>c ${d}`
})
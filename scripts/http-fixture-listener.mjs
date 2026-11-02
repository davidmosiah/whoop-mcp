// Test-only instrumentation: report the actual port after the child owns its
// loopback listener. No reserve/release/rebind window and no production change.
import { Server } from 'node:net';
const listen = Server.prototype.listen;
Server.prototype.listen = function (...args) {
  this.once('listening', () => {
    const address = this.address();
    if (address && typeof address === 'object' && process.connected) {
      process.send({ type: 'http-fixture-listening', address: address.address, port: address.port });
    }
  });
  return Reflect.apply(listen, this, args);
};

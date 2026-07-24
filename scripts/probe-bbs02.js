#!/usr/bin/env node
/*
 * Standalone BBS02 UART link test — bypasses the app entirely.
 * Sends the same READ-ONLY requests the app sends and dumps raw RX bytes.
 *
 * Usage:  node scripts/probe-bbs02.js [/dev/cu.usbserial-XXXX]
 * (with no argument it auto-picks the first usbserial/wchusbserial port)
 */
const { SerialPort } = require('../release/app/node_modules/serialport');

const REQUESTS = [
    ['info', [0x11, 0x51, 0x04, 0xb0, 0x05]],
    ['basic', [0x11, 0x52]],
    ['pedal', [0x11, 0x53]],
    ['throttle', [0x11, 0x54]],
];

async function main() {
    let path = process.argv[2];
    if (!path) {
        const ports = await SerialPort.list();
        const candidates = ports
            .map((p) => p.path)
            .filter((p) => /usbserial|wchusbserial/i.test(p));
        if (candidates.length === 0) {
            console.error(
                'No usbserial port found. Ports seen:',
                ports.map((p) => p.path).join(', ') || '(none)',
            );
            process.exit(1);
        }
        [path] = candidates;
    }
    console.log(`Opening ${path} @ 1200 8N1 ...`);
    const port = new SerialPort({ path, baudRate: 1200, autoOpen: false });

    let rxTotal = 0;
    port.on('data', (data) => {
        rxTotal += data.length;
        console.log(`  RX ${data.length}B: ${data.toString('hex')}`);
    });

    port.open((err) => {
        if (err) {
            console.error('OPEN FAILED:', err.message);
            process.exit(1);
        }
        console.log('Port open. Sending read requests 1s apart...');
        REQUESTS.forEach(([label, bytes], i) => {
            setTimeout(() => {
                console.log(`TX ${label}: ${Buffer.from(bytes).toString('hex')}`);
                port.write(Buffer.from(bytes));
            }, i * 1000);
        });
        setTimeout(() => {
            console.log(
                rxTotal > 0
                    ? `\nRESULT: link OK — received ${rxTotal} bytes total.`
                    : '\nRESULT: NO response. Check: battery switched ON, cable fully seated in the display connector, correct port.',
            );
            port.close(() => process.exit(0));
        }, REQUESTS.length * 1000 + 3000);
    });
}

main();

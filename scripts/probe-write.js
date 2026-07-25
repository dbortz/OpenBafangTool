#!/usr/bin/env node
/*
 * BBS02 write-ack capture — sends a NO-OP write (the exact pedal parameters
 * already on the bike, captured 2026-07-25) and dumps the raw ack bytes.
 * Tries the upstream checksum first, then the code+2+payload variant if the
 * controller stays silent. Finishes with a pedal read-back to confirm state.
 *
 * Usage:  node scripts/probe-write.js [/dev/cu.usbserial-XXXX]
 */
const { SerialPort } = require('../release/app/node_modules/serialport');

// Pedal payload EXACTLY as read from the bike (incl. work mode byte 0xff)
const PEDAL_DATA = [
    0x03, 0xff, 0x18, 0x0a, 0x06, 0x04, 0xff, 0x0a, 0x08, 0x00, 0x50,
];

function writePacket(cmd, data, checksumStyle) {
    // upstream: checksum = cmd[1] + len + data ; variant: cmd[1] + 2 + data
    let sum = checksumStyle === 'len' ? data.length : 2;
    sum += cmd[1];
    data.forEach((b) => {
        sum += b;
    });
    return Buffer.from([...cmd, data.length, ...data, sum & 0xff]);
}

const PEDAL_READ = Buffer.from([0x11, 0x53]);

async function main() {
    let path = process.argv[2];
    if (!path) {
        const ports = await SerialPort.list();
        const candidates = ports
            .map((p) => p.path)
            .filter((p) => /usbserial|wchusbserial/i.test(p));
        if (candidates.length === 0) {
            console.error('No usbserial port found.');
            process.exit(1);
        }
        [path] = candidates;
    }
    console.log(`Opening ${path} @ 1200 8N1 ...`);
    const port = new SerialPort({ path, baudRate: 1200, autoOpen: false });

    let phase = 'idle';
    let rxSincePhase = [];
    port.on('data', (data) => {
        rxSincePhase.push(...data);
        console.log(`  [${phase}] RX ${data.length}B: ${data.toString('hex')}`);
    });

    const step = (label, buf, delay) =>
        new Promise((resolve) => {
            setTimeout(() => {
                phase = label;
                rxSincePhase = [];
                console.log(`TX ${label}: ${buf.toString('hex')}`);
                port.write(buf);
                setTimeout(() => resolve(rxSincePhase.length), 2500);
            }, delay);
        });

    port.open(async (err) => {
        if (err) {
            console.error('OPEN FAILED:', err.message);
            process.exit(1);
        }
        console.log('Port open.\n');

        const gotUpstream = await step(
            'write-pedal (upstream checksum)',
            writePacket([0x16, 0x53], PEDAL_DATA, 'len'),
            500,
        );
        let gotVariant = 0;
        if (gotUpstream === 0) {
            console.log('  no ack for upstream checksum, trying +2 variant');
            gotVariant = await step(
                'write-pedal (+2 checksum)',
                writePacket([0x16, 0x53], PEDAL_DATA, 'two'),
                500,
            );
        }
        await step('read-back pedal', PEDAL_READ, 500);

        console.log('\nRESULT:');
        if (gotUpstream > 0) {
            console.log('  Controller ACKED the upstream-style write.');
        } else if (gotVariant > 0) {
            console.log('  Controller ACKED only the +2-style write.');
        } else {
            console.log('  No ack for either write style.');
        }
        console.log(
            '  Read-back above should show: 53 0b 03 ff 18 0a 06 04 ff 0a 08 00 50 e4',
        );
        port.close(() => process.exit(0));
    });
}

main();

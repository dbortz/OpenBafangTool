import BafangUartMotor from '../device/high-level/BafangUartMotor';

/*
 * Regression test with REAL packets captured from a BBS02B (HZXT SZZ9,
 * fw 2.0.1.1) on 2026-07-25 via scripts/probe-bbs02.js. This controller
 * computes response checksums as code + 2 + payload, which the original
 * processBuffer (expecting code + len + payload) rejected as garbage.
 */

const hex = (s: string) =>
    new Uint8Array(s.split(' ').map((b) => parseInt(b, 16)));

const INFO = hex('51 10 48 5a 58 54 53 5a 5a 39 31 31 32 30 31 31 02 19 22');
const BASIC = hex(
    '52 18 29 0f 1e 1e 32 32 3c 3c 46 46 64 64 64 64 64 64 64 64 64 64 64 64 37 01 18',
);
const PEDAL = hex('53 0b 03 ff 18 0a 06 04 ff 0a 08 00 50 e4');
const THROTTLE = hex('54 06 0b 23 01 ff 18 0a a6');

function feedByteByByte(motor: BafangUartMotor, packet: Uint8Array): void {
    // Simulate 1200-baud reality: bytes arrive one at a time
    packet.forEach((byte) => {
        const m = motor as any;
        m.portBuffer = new Uint8Array([...Array.from(m.portBuffer), byte]);
        m.processBuffer();
    });
}

describe('BafangUartMotor packet parsing (real BBS02B capture)', () => {
    it('parses all four packets with code+2+payload checksums', () => {
        const motor = new BafangUartMotor('demo');
        [INFO, BASIC, PEDAL, THROTTLE].forEach((packet) =>
            feedByteByByte(motor, packet),
        );

        const info = motor.getInfo();
        expect(info.manufacturer).toBe('HZXT');
        expect(info.model).toBe('SZZ9');
        expect(info.voltage).toBe(48);
        expect(info.max_current).toBe(25);

        const basic = motor.getBasicParameters();
        expect(basic.low_battery_protection).toBe(41);
        expect(basic.current_limit).toBe(15);
        expect(basic.wheel_diameter).toBe(27.5);
        expect(basic.magnets_per_wheel_rotation).toBe(1);
        expect(basic.assist_profiles.map((p) => p.current_limit)).toEqual([
            30, 30, 50, 50, 60, 60, 70, 70, 100, 100,
        ]);
        expect(
            basic.assist_profiles.every((p) => p.speed_limit === 100),
        ).toBe(true);

        const pedal = motor.getPedalParameters();
        expect(pedal.pedal_type).toBe(3);
        expect(pedal.pedal_assist_level).toBe(255);
        expect(pedal.pedal_speed_limit).toBe(24);
        expect(pedal.pedal_start_current).toBe(10);
        expect(pedal.pedal_slow_start_mode).toBe(6);
        expect(pedal.pedal_time_to_stop).toBe(100);
        expect(pedal.pedal_current_decay).toBe(8);
        expect(pedal.pedal_keep_current).toBe(80);

        const throttle = motor.getThrottleParameters();
        expect(throttle.throttle_start_voltage).toBe(1.1);
        expect(throttle.throttle_end_voltage).toBe(3.5);
        expect(throttle.throttle_mode).toBe(1);
        expect(throttle.throttle_assist_level).toBe(255);
        expect(throttle.throttle_speed_limit).toBe(24);
        expect(throttle.throttle_start_current).toBe(10);
    });

    it('still accepts the code+len+payload checksum variant', () => {
        // Same pedal packet, checksum recomputed the original way:
        // sum(code, len, payload) & 0xff = 0xed
        const packet = hex('53 0b 03 ff 18 0a 06 04 ff 0a 08 00 50 ed');
        const motor = new BafangUartMotor('demo');
        feedByteByByte(motor, packet);
        expect(motor.getPedalParameters().pedal_speed_limit).toBe(24);
    });
});

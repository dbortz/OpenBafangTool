import {
    checkBasicParameters,
    checkPedalParameters,
    checkThrottleParameters,
} from '../types/BafangUartMotorTypes';
import {
    deleteProfile,
    listProfiles,
    loadProfile,
    saveProfile,
} from '../profiles/BafangUartProfileStore';

const sampleBasic = {
    low_battery_protection: 41,
    current_limit: 25,
    assist_profiles: Array.from({ length: 10 }, (_, i) => ({
        current_limit: i === 0 ? 1 : i * 10 + 10,
        speed_limit: i === 0 ? 1 : 100,
    })),
    wheel_diameter: 28,
    magnets_per_wheel_rotation: 1,
    speedmeter_type: 0,
};

const samplePedal = {
    pedal_type: 3,
    pedal_assist_level: 255,
    pedal_speed_limit: 24,
    pedal_start_current: 10,
    pedal_slow_start_mode: 6,
    pedal_signals_before_start: 4,
    pedal_time_to_stop: 100,
    pedal_current_decay: 8,
    pedal_stop_decay: 0,
    pedal_keep_current: 80,
};

const sampleThrottle = {
    throttle_start_voltage: 1.1,
    throttle_end_voltage: 3.5,
    throttle_mode: 1,
    throttle_assist_level: 255,
    throttle_speed_limit: 24,
    throttle_start_current: 10,
};

describe('BafangUartProfileStore', () => {
    const TEST_NAME = 'jest-temporary-test-profile';
    const TEST_FILENAME = `${TEST_NAME}.json`;

    afterAll(() => {
        try {
            deleteProfile(TEST_FILENAME);
        } catch (e) {
            /* already deleted by the test */
        }
    });

    it('round-trips save -> list -> load -> delete', () => {
        const filename = saveProfile(
            TEST_NAME,
            null,
            sampleBasic,
            samplePedal,
            sampleThrottle,
        );
        expect(filename).toBe(TEST_FILENAME);

        const names = listProfiles().map((p) => p.name);
        expect(names).toContain(TEST_NAME);

        const loaded = loadProfile(filename);
        expect(loaded.basic).toEqual(sampleBasic);
        expect(loaded.pedal).toEqual(samplePedal);
        expect(loaded.throttle).toEqual(sampleThrottle);

        deleteProfile(filename);
        expect(listProfiles().map((p) => p.name)).not.toContain(TEST_NAME);
    });

    it('strips extra keys (e.g. whole component state) on save and load', () => {
        // Simulate passing a whole component state as each section
        const polluted: any = {
            ...sampleBasic,
            ...samplePedal,
            ...sampleThrottle,
            profiles: [{ name: 'stale', filename: 'stale.json', created: '' }],
            selectedProfile: 'stale.json',
            newProfileName: 'junk',
            formEpoch: 42,
            oldStyle: true,
        };
        const filename = saveProfile(
            TEST_NAME,
            null,
            polluted,
            polluted,
            polluted,
        );
        const loaded = loadProfile(filename);
        expect(loaded.basic).toEqual(sampleBasic);
        expect(loaded.pedal).toEqual(samplePedal);
        expect(loaded.throttle).toEqual(sampleThrottle);
        expect((loaded.basic as any).profiles).toBeUndefined();
        expect((loaded.basic as any).selectedProfile).toBeUndefined();
        deleteProfile(filename);
    });

    it('sanitizes polluted legacy profile files on load', () => {
        // Write a file the way the buggy version did: sections holding a
        // whole state dump
        const fs = require('fs');
        const path = require('path');
        const getAppDataPath = require('appdata-path');
        const polluted = {
            ...sampleBasic,
            ...samplePedal,
            ...sampleThrottle,
            profiles: [{ name: 'stale', filename: 'stale.json', created: '' }],
            selectedProfile: 'stale.json',
        };
        const dir = path.join(getAppDataPath('open-bafang-tool'), 'profiles');
        const filename = 'jest-legacy-polluted.json';
        fs.writeFileSync(
            path.join(dir, filename),
            JSON.stringify({
                format: 'obt-uart-profile',
                version: 1,
                name: 'jest-legacy-polluted',
                created: '2026-07-24T00:00:00.000Z',
                motor_info: null,
                basic: polluted,
                pedal: polluted,
                throttle: polluted,
            }),
            'utf-8',
        );
        try {
            const loaded = loadProfile(filename);
            expect(loaded.basic).toEqual(sampleBasic);
            expect((loaded.basic as any).profiles).toBeUndefined();
            expect((loaded.pedal as any).selectedProfile).toBeUndefined();
        } finally {
            deleteProfile(filename);
        }
    });

    it('rejects invalid parameters on save', () => {
        expect(() =>
            saveProfile(
                TEST_NAME,
                null,
                { ...sampleBasic, current_limit: 0 },
                samplePedal,
                sampleThrottle,
            ),
        ).toThrow();
    });

    it('validates the seeded stock and kidsafe profiles if present', () => {
        listProfiles()
            .filter((p) => ['stock-2026-07-17', 'kidsafe'].includes(p.name))
            .forEach((p) => {
                const profile = loadProfile(p.filename);
                expect(checkBasicParameters(profile.basic)).toBe(true);
                expect(checkPedalParameters(profile.pedal)).toBe(true);
                expect(checkThrottleParameters(profile.throttle)).toBe(true);
            });
    });
});

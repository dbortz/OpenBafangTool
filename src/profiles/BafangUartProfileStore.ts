import getAppDataPath from 'appdata-path';
import log from 'electron-log/renderer';
import path from 'path';
import {
    BafangUartMotorBasicParameters,
    BafangUartMotorInfo,
    BafangUartMotorPedalParameters,
    BafangUartMotorThrottleParameters,
    checkBasicParameters,
    checkPedalParameters,
    checkThrottleParameters,
} from '../types/BafangUartMotorTypes';

export type BafangUartProfile = {
    format: 'obt-uart-profile';
    version: 1;
    name: string;
    created: string;
    motor_info: BafangUartMotorInfo | null;
    basic: BafangUartMotorBasicParameters;
    pedal: BafangUartMotorPedalParameters;
    throttle: BafangUartMotorThrottleParameters;
};

export type BafangUartProfileSummary = {
    name: string;
    filename: string;
    created: string;
};

function profilesDir(): string {
    return path.join(getAppDataPath('open-bafang-tool'), 'profiles');
}

function slugify(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9-_ ]/g, '')
        .trim()
        .replace(/\s+/g, '-');
}

export function listProfiles(): BafangUartProfileSummary[] {
    const fs = require('fs');
    const dir = profilesDir();
    if (!fs.existsSync(dir)) return [];
    const summaries: BafangUartProfileSummary[] = [];
    fs.readdirSync(dir)
        .filter((f: string) => f.endsWith('.json'))
        .forEach((filename: string) => {
            try {
                const profile = JSON.parse(
                    fs.readFileSync(path.join(dir, filename), 'utf-8'),
                );
                if (profile.format === 'obt-uart-profile') {
                    summaries.push({
                        name: profile.name ?? filename,
                        filename,
                        created: profile.created ?? '',
                    });
                }
            } catch (e) {
                log.error(`Failed to read profile file ${filename}:`, e);
            }
        });
    return summaries.sort((a, b) => a.name.localeCompare(b.name));
}

export function saveProfile(
    name: string,
    motorInfo: BafangUartMotorInfo | null,
    basic: BafangUartMotorBasicParameters,
    pedal: BafangUartMotorPedalParameters,
    throttle: BafangUartMotorThrottleParameters,
): string {
    if (!checkBasicParameters(basic)) {
        throw new Error('Basic parameters failed validation');
    }
    if (!checkPedalParameters(pedal)) {
        throw new Error('Pedal parameters failed validation');
    }
    if (!checkThrottleParameters(throttle)) {
        throw new Error('Throttle parameters failed validation');
    }
    const slug = slugify(name);
    if (!slug) throw new Error('Profile name is empty');
    const profile: BafangUartProfile = {
        format: 'obt-uart-profile',
        version: 1,
        name,
        created: new Date().toISOString(),
        motor_info: motorInfo,
        basic,
        pedal,
        throttle,
    };
    const fs = require('fs');
    const dir = profilesDir();
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    const filename = `${slug}.json`;
    fs.writeFileSync(
        path.join(dir, filename),
        JSON.stringify(profile, null, 2),
        'utf-8',
    );
    return filename;
}

export function loadProfile(filename: string): BafangUartProfile {
    const fs = require('fs');
    const profile = JSON.parse(
        fs.readFileSync(path.join(profilesDir(), filename), 'utf-8'),
    );
    if (profile.format !== 'obt-uart-profile') {
        throw new Error('Not a profile file');
    }
    if (!checkBasicParameters(profile.basic)) {
        throw new Error('Basic parameters failed validation');
    }
    if (!checkPedalParameters(profile.pedal)) {
        throw new Error('Pedal parameters failed validation');
    }
    if (!checkThrottleParameters(profile.throttle)) {
        throw new Error('Throttle parameters failed validation');
    }
    return profile as BafangUartProfile;
}

export function deleteProfile(filename: string): void {
    const fs = require('fs');
    fs.unlinkSync(path.join(profilesDir(), filename));
}

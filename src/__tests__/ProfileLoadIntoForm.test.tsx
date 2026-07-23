import '@testing-library/jest-dom';
import { render, screen, act } from '@testing-library/react';

Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
    }),
});
import React from 'react';
import BafangUartMotor from '../device/high-level/BafangUartMotor';
import BafangUartMotorSettingsView from '../ui/panels/bafang/uart/full/BafangUartMotorSettingsView';
import { deleteProfile, saveProfile } from '../profiles/BafangUartProfileStore';

// Marker values chosen to not collide with any demo-mode value
const markerBasic = {
    low_battery_protection: 33,
    current_limit: 17,
    assist_profiles: Array.from({ length: 10 }, () => ({
        current_limit: 44,
        speed_limit: 88,
    })),
    wheel_diameter: 26,
    magnets_per_wheel_rotation: 2,
    speedmeter_type: 0,
};

const markerPedal = {
    pedal_type: 3,
    pedal_assist_level: 255,
    pedal_speed_limit: 21,
    pedal_start_current: 11,
    pedal_slow_start_mode: 7,
    pedal_signals_before_start: 4,
    pedal_time_to_stop: 110,
    pedal_current_decay: 6,
    pedal_stop_decay: 0,
    pedal_keep_current: 77,
};

const markerThrottle = {
    throttle_start_voltage: 1.2,
    throttle_end_voltage: 3.6,
    throttle_mode: 1,
    throttle_assist_level: 255,
    throttle_speed_limit: 22,
    throttle_start_current: 12,
};

describe('Load profile into form refreshes visible inputs', () => {
    const NAME = 'jest-load-into-form-marker';
    const FILENAME = `${NAME}.json`;

    beforeAll(() => {
        saveProfile(NAME, null, markerBasic, markerPedal, markerThrottle);
    });

    afterAll(() => {
        try {
            deleteProfile(FILENAME);
        } catch (e) {
            /* noop */
        }
    });

    it('shows profile values in inputs after loadProfileIntoForm', async () => {
        const connection = new BafangUartMotor('demo');
        connection.loadData();
        // demo loadData emits 'data' after 300ms
        await act(
            () => new Promise((resolve) => setTimeout(resolve, 400)),
        );

        const ref = React.createRef<BafangUartMotorSettingsView>();
        render(
            <BafangUartMotorSettingsView ref={ref} connection={connection} />,
        );

        // Demo current limit is 12 — should be shown before the load
        expect(
            screen.queryByDisplayValue('17'),
        ).not.toBeInTheDocument();

        act(() => {
            ref.current!.setState({ selectedProfile: FILENAME });
        });
        act(() => {
            ref.current!.loadProfileIntoForm();
        });

        // current_limit 17 and low_battery_protection 33 should now be visible
        expect(screen.getByDisplayValue('17')).toBeInTheDocument();
        expect(screen.getByDisplayValue('33')).toBeInTheDocument();

        // the assist level table must also refresh: 10 rows of current 44 / speed 88
        expect(screen.getAllByDisplayValue('44').length).toBeGreaterThanOrEqual(
            10,
        );
        expect(screen.getAllByDisplayValue('88').length).toBeGreaterThanOrEqual(
            10,
        );
    });
});

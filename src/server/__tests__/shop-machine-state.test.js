/* eslint-env jest */
import { canRunToolMacro } from '../../app/containers/Shop/machine-state';

const ready = () => ({
    connected: true,
    port: '/dev/ttyACM0',
    type: 'Grbl',
    state: { status: { activeState: 'Idle' } },
    workflow: { state: 'idle' },
    settings: { settings: { $32: '0' } }
});

describe('Shop tool-setting motion gate', () => {
    test('allows a fresh idle milling controller', () => {
        expect(canRunToolMacro(ready(), true)).toBe(true);
    });
    test('blocks stale status, disconnects and absent serial ports', () => {
        expect(canRunToolMacro(ready(), false)).toBe(false);
        expect(canRunToolMacro({ ...ready(), connected: false }, true)).toBe(false);
        expect(canRunToolMacro({ ...ready(), port: '' }, true)).toBe(false);
    });
    test.each(['Run', 'Hold', 'Alarm', 'Home', undefined])('blocks machine state %s', (activeState) => {
        expect(canRunToolMacro({ ...ready(), state: { status: { activeState } } }, true)).toBe(false);
    });
    test.each(['running', 'paused'])('blocks workflow %s', (state) => {
        expect(canRunToolMacro({ ...ready(), workflow: { state } }, true)).toBe(false);
    });
    test.each(['1', undefined, null, '', false, 'invalid'])('blocks laser or unverified mode %s', ($32) => {
        expect(canRunToolMacro({ ...ready(), settings: { settings: { $32 } } }, true)).toBe(false);
    });
    test('blocks other controller types', () => {
        expect(canRunToolMacro({ ...ready(), type: 'Marlin' }, true)).toBe(false);
    });
});

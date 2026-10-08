/* eslint-env jest */
import simulateAsync from '../simulate-async';

test('worker keeps parsing isolated, rejects concurrency and releases slot before resolving', async () => {
  const first = simulateAsync('G21 G90\nG1 X10 F100');
  await expect(simulateAsync('G21 G90\nG0 X2')).rejects.toMatchObject({ status: 429 });
  expect((await first).complete).toBe(true);
  expect((await simulateAsync('G21 G90\nG0 X2')).complete).toBe(true);
  await expect(simulateAsync('')).rejects.toThrow('nonempty');
  expect((await simulateAsync('G21 G90\nG0 X2')).complete).toBe(true);
});

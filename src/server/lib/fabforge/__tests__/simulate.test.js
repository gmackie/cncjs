/* eslint-env jest */
import simulate from '../simulate';

const header = 'G21 G90 G17 G94\n';
describe('offline CNC backplot', () => {
  test('tracks modal linear moves, feed time, rapid motion and spindle state', () => {
    const result = simulate(header + 'G0 Z5\nM3 S1000\nG1 X10 F600\nY10\nM5\nG0 Z10');
    expect(result.complete).toBe(true);
    expect(result.segments[2]).toMatchObject({
      from: [10, 0, 5],
      to: [10, 10, 5],
      spindle: 'M3',
      power: 1000,
      seconds: 1
    });
    expect(result.bounds).toEqual({ min: [0, 0, 0], max: [10, 10, 10] });
    expect(result.seconds).toBeCloseTo(2.2);
  });
  test('converts inches and incremental coordinates to millimeters', () => {
    const result = simulate('G20 G91\nG1 X1 F60\nY.5\nX-1');
    expect(result.complete).toBe(true);
    expect(result.segments[2].to).toEqual([0, 12.7, 0]);
    expect(result.seconds).toBeCloseTo(2.5);
  });
  test('interpolates CCW, CW and full-circle helical XY arcs', () => {
    const result = simulate(header + 'G0 X10\nG3 X0 Y10 I-10 J0 F600\nG2 X10 Y0 I0 J-10\nG3 I-10 Z5');
    expect(result.complete).toBe(true);
    expect(result.bounds.min[0]).toBeCloseTo(-10);
    expect(result.bounds.min[1]).toBeCloseTo(-10);
    expect(result.segments[result.segments.length - 1].to).toEqual([10, 0, 5]);
    expect(result.distance).toBeGreaterThan(100);
  });
  test.each([
    'G53 G0 X1',
    'G92 X0',
    'G10 L20 P1 Z0',
    'G38.2 Z-10 F100',
    'G18',
    'M6 T2',
    'G2 X1 R5 F100',
    '%wait',
    '$H',
    'G1 X[1+2]',
    'G90 G91 X1',
    'G1 X1 X2 F100'
  ])('stops at unsupported or ambiguous block %s', (code) => {
    const result = simulate(header + 'G0 X5\n' + code + '\nG0 X100');
    expect(result.complete).toBe(false);
    expect(result.errors[0].line).toBe(3);
    expect(result.segments).toHaveLength(1);
  });
  test('rejects missing preamble, feed and invalid radii', () => {
    expect(simulate('G0 X1').complete).toBe(false);
    expect(simulate(header + 'G1 X1').complete).toBe(false);
    expect(simulate(header + 'G2 X10 I1 F100').complete).toBe(false);
  });
  test('does not execute macro-looking comments or content after program end', () => {
    const result = simulate(header + '(G53 $H) G0 X2 ; M3\nM30\nG0 X100');
    expect(result.complete).toBe(true);
    expect(result.segments).toHaveLength(1);
    expect(result.warnings).toHaveLength(1);
  });
  test('rejects empty, binary and excessive input', () => {
    expect(() => simulate('')).toThrow();
    expect(() => simulate('G0\0')).toThrow();
    expect(() => simulate('x'.repeat(2 * 1024 * 1024 + 1))).toThrow();
    expect(() => simulate('\n'.repeat(20001) + 'G0')).toThrow();
  });
});

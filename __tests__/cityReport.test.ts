import { isReportable, REPORT_SITUATIONS } from '../src/core/reports';

describe('the "Report a problem" dropdown on the City view', () => {
  test('offers exactly the problems that can be counted, and none that are emergencies', () => {
    expect([...REPORT_SITUATIONS].sort()).toEqual(['downed_line', 'medical_device', 'need_shelter', 'need_supplies', 'power_outage', 'street_hazard']);
    expect(REPORT_SITUATIONS.every(isReportable)).toBe(true);
  });
});

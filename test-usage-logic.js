function getUsagePeriodId() {
    const now = new Date();
    const periodStart = new Date(now.getTime() - 8 * 60 * 60 * 1000);
    return periodStart.toISOString().split('T')[0];
}
console.log(getUsagePeriodId());

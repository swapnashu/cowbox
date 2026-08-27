/**
 * Utility to generate wildcard sslip.io domains for instant zero-DNS deployments
 */
export function generateSslipDomain(appName: string, serverIp: string = "127.0.0.1"): string {
  const cleanName = appName.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const cleanIp = serverIp.trim().replace(/^https?:\/\//, "").split(":")[0] || "127.0.0.1";
  return `${cleanName}.${cleanIp}.sslip.io`;
}

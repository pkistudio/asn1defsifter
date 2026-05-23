export type PkiProfileName = 'components' | 'x509' | 'pkcs10' | 'pkcs8' | 'cms';

export const pkiProfileTypeNames: Record<PkiProfileName, string[]> = {
  components: [
    'AlgorithmIdentifier',
    'AttributeTypeAndValue',
    'DirectoryString',
    'Extension',
    'Extensions',
    'Name',
    'RelativeDistinguishedName',
    'RDNSequence',
    'SubjectPublicKeyInfo',
    'Time',
    'Validity'
  ],
  x509: [
    'Certificate',
    'TBSCertificate',
    'Version',
    'CertificateSerialNumber',
    'AlgorithmIdentifier',
    'Name',
    'Validity',
    'SubjectPublicKeyInfo',
    'Extension',
    'Extensions'
  ],
  pkcs10: [
    'CertificationRequest',
    'CertificationRequestInfo',
    'AlgorithmIdentifier',
    'Name',
    'SubjectPublicKeyInfo',
    'AttributeTypeAndValue'
  ],
  pkcs8: [
    'PrivateKeyInfo',
    'AlgorithmIdentifier',
    'AttributeTypeAndValue'
  ],
  cms: [
    'ContentInfo',
    'AlgorithmIdentifier'
  ]
};

export function getPkiProfileTypeNames(profiles: PkiProfileName | PkiProfileName[]): string[] {
  const profileList = Array.isArray(profiles) ? profiles : [profiles];
  return [...new Set(profileList.flatMap((profile) => pkiProfileTypeNames[profile]))];
}
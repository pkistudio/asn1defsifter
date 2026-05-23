import { parseAsn1DefinitionCorpus } from '../adapters/asn1instancebuilder.js';
import type { SchemaCorpus } from '../core/types.js';

export const pkiComponentDefinition = `PkiComponents DEFINITIONS EXPLICIT TAGS ::= BEGIN
Version ::= INTEGER { v1(0), v2(1), v3(2) }
CertificateSerialNumber ::= INTEGER
AlgorithmIdentifier ::= SEQUENCE {
  algorithm OBJECT IDENTIFIER,
  parameters CHOICE { null NULL, namedCurve OBJECT IDENTIFIER } OPTIONAL
}
AttributeTypeAndValue ::= SEQUENCE {
  type OBJECT IDENTIFIER,
  value DirectoryString
}
DirectoryString ::= CHOICE {
  utf8String UTF8String,
  printableString PrintableString,
  ia5String IA5String
}
RelativeDistinguishedName ::= SET OF AttributeTypeAndValue
RDNSequence ::= SEQUENCE OF RelativeDistinguishedName
Name ::= CHOICE {
  rdnSequence RDNSequence
}
Time ::= CHOICE {
  utcTime UTCTime,
  generalizedTime GeneralizedTime
}
Validity ::= SEQUENCE {
  notBefore Time,
  notAfter Time
}
SubjectPublicKeyInfo ::= SEQUENCE {
  algorithm AlgorithmIdentifier,
  subjectPublicKey BIT STRING
}
RSAPublicKey ::= SEQUENCE {
  modulus INTEGER,
  publicExponent INTEGER
}
Extension ::= SEQUENCE {
  extnID OBJECT IDENTIFIER,
  critical BOOLEAN DEFAULT FALSE,
  extnValue OCTET STRING
}
Extensions ::= SEQUENCE OF Extension
TBSCertificate ::= SEQUENCE {
  version [0] EXPLICIT Version DEFAULT v1,
  serialNumber CertificateSerialNumber,
  signature AlgorithmIdentifier,
  issuer Name,
  validity Validity,
  subject Name,
  subjectPublicKeyInfo SubjectPublicKeyInfo,
  issuerUniqueID [1] IMPLICIT BIT STRING OPTIONAL,
  subjectUniqueID [2] IMPLICIT BIT STRING OPTIONAL,
  extensions [3] EXPLICIT Extensions OPTIONAL
}
Certificate ::= SEQUENCE {
  tbsCertificate TBSCertificate,
  signatureAlgorithm AlgorithmIdentifier,
  signatureValue BIT STRING
}
CertificationRequestInfo ::= SEQUENCE {
  version INTEGER,
  subject Name,
  subjectPKInfo SubjectPublicKeyInfo,
  attributes [0] IMPLICIT SET OF AttributeTypeAndValue OPTIONAL
}
CertificationRequest ::= SEQUENCE {
  certificationRequestInfo CertificationRequestInfo,
  signatureAlgorithm AlgorithmIdentifier,
  signature BIT STRING
}
PrivateKeyInfo ::= SEQUENCE {
  version INTEGER,
  privateKeyAlgorithm AlgorithmIdentifier,
  privateKey OCTET STRING,
  attributes [0] IMPLICIT SET OF AttributeTypeAndValue OPTIONAL
}
ContentInfo ::= SEQUENCE {
  contentType OBJECT IDENTIFIER,
  content [0] EXPLICIT OCTET STRING OPTIONAL
}
END`;

let cachedPkiComponentCorpus: SchemaCorpus | undefined;

export function createPkiComponentCorpus(): SchemaCorpus {
  cachedPkiComponentCorpus ??= parseAsn1DefinitionCorpus(pkiComponentDefinition);
  return cachedPkiComponentCorpus;
}
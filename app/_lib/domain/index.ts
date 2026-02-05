/**
 * Domain Module
 * 
 * Custom domain verification and management.
 */

export {
  generateVerificationToken,
  validateDomainFormat,
  normalizeDomain,
  verifyDomainOwnership,
  setupCustomDomain,
  verifyAndActivateDomain,
  removeCustomDomain,
  getDomainInstructions,
  type DomainVerificationResult,
  type DomainConfigResult,
} from './verification.service';

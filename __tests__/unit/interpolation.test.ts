/**
 * Interpolation Service Tests
 * 
 * Priority: P1 - High
 * If broken: Emails will have broken templates, XSS vulnerabilities
 * 
 * Tests:
 * - Basic interpolation: {{lead.email}}
 * - Nested paths: {{lead.custom.barcode}}
 * - HTML escaping by default
 * - Raw output with {{{var}}}
 * - Missing variables → empty string
 * - Invalid syntax preserved (graceful)
 */

import { describe, it, expect } from 'vitest';
import {
  InterpolationService,
} from '@/app/_lib/services/interpolation.service';
import { InterpolationContext } from '@/app/_lib/types/custom-fields';

describe('Interpolation Service', () => {
  // Test context with various data
  const fullContext: InterpolationContext = {
    lead: {
      id: 'lead-123',
      email: 'test@example.com',
      stage: 'CAPTURED',
      source: 'landing',
      custom: {
        barcode: '12345',
        membershipType: 'premium',
        numericValue: 42,
      },
    },
    workspace: {
      id: 'ws-123',
      name: 'Sports West',
      slug: 'sportswest',
    },
    trigger: {
      adapter: 'revline',
      operation: 'form_submitted',
      payload: {
        formId: 'signup',
        amount: 99.99,
      },
    },
    extra: {
      customKey: 'customValue',
    },
  };

  describe('interpolate', () => {
    describe('Basic Interpolation', () => {
      it('should interpolate lead email', () => {
        const template = 'Hello {{lead.email}}!';
        const result = InterpolationService.interpolate(template, fullContext);
        expect(result).toBe('Hello test@example.com!');
      });

      it('should interpolate lead stage', () => {
        const template = 'Status: {{lead.stage}}';
        const result = InterpolationService.interpolate(template, fullContext);
        expect(result).toBe('Status: CAPTURED');
      });

      it('should interpolate workspace name', () => {
        const template = 'Welcome to {{workspace.name}}';
        const result = InterpolationService.interpolate(template, fullContext);
        expect(result).toBe('Welcome to Sports West');
      });

      it('should interpolate trigger data', () => {
        const template = 'Form: {{trigger.payload.formId}}';
        const result = InterpolationService.interpolate(template, fullContext);
        expect(result).toBe('Form: signup');
      });
    });

    describe('Nested Path Interpolation', () => {
      it('should interpolate custom field values', () => {
        const template = 'Barcode: {{lead.custom.barcode}}';
        const result = InterpolationService.interpolate(template, fullContext);
        expect(result).toBe('Barcode: 12345');
      });

      it('should interpolate multiple custom fields', () => {
        const template = '{{lead.custom.barcode}} - {{lead.custom.membershipType}}';
        const result = InterpolationService.interpolate(template, fullContext);
        expect(result).toBe('12345 - premium');
      });

      it('should interpolate numeric values as strings', () => {
        const template = 'Value: {{lead.custom.numericValue}}';
        const result = InterpolationService.interpolate(template, fullContext);
        expect(result).toBe('Value: 42');
      });

      it('should interpolate trigger payload values', () => {
        const template = 'Amount: ${{trigger.payload.amount}}';
        const result = InterpolationService.interpolate(template, fullContext);
        expect(result).toBe('Amount: $99.99');
      });
    });

    describe('HTML Escaping', () => {
      it('should escape HTML special characters by default', () => {
        const contextWithHtml: InterpolationContext = {
          lead: {
            id: '1',
            email: 'test@example.com',
            stage: 'CAPTURED',
            source: null,
            custom: {
              name: '<script>alert("XSS")</script>',
            },
          },
        };

        const template = 'Name: {{lead.custom.name}}';
        const result = InterpolationService.interpolate(template, contextWithHtml);
        expect(result).toBe('Name: &lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
      });

      it('should escape ampersands', () => {
        const contextWithAmp: InterpolationContext = {
          workspace: {
            id: '1',
            name: 'Tom & Jerry Gym',
            slug: 'tomjerry',
          },
        };

        const template = '{{workspace.name}}';
        const result = InterpolationService.interpolate(template, contextWithAmp);
        expect(result).toBe('Tom &amp; Jerry Gym');
      });

      it('should escape quotes', () => {
        const contextWithQuotes: InterpolationContext = {
          lead: {
            id: '1',
            email: 'test@example.com',
            stage: 'CAPTURED',
            source: null,
            custom: {
              note: 'He said "hello"',
            },
          },
        };

        const template = '{{lead.custom.note}}';
        const result = InterpolationService.interpolate(template, contextWithQuotes);
        expect(result).toBe('He said &quot;hello&quot;');
      });
    });

    describe('Raw Output (No Escaping)', () => {
      it('should not escape with triple braces', () => {
        const contextWithHtml: InterpolationContext = {
          lead: {
            id: '1',
            email: 'test@example.com',
            stage: 'CAPTURED',
            source: null,
            custom: {
              htmlContent: '<b>Bold</b>',
            },
          },
        };

        const template = 'Content: {{{lead.custom.htmlContent}}}';
        const result = InterpolationService.interpolate(template, contextWithHtml);
        expect(result).toBe('Content: <b>Bold</b>');
      });

      it('should handle mixed escaped and raw variables', () => {
        const ctx: InterpolationContext = {
          lead: {
            id: '1',
            email: 'a@b.com',
            stage: 'CAPTURED',
            source: null,
            custom: {
              safe: 'Hello & Goodbye',
              html: '<em>emphasis</em>',
            },
          },
        };

        const template = '{{lead.custom.safe}} | {{{lead.custom.html}}}';
        const result = InterpolationService.interpolate(template, ctx);
        expect(result).toBe('Hello &amp; Goodbye | <em>emphasis</em>');
      });
    });

    describe('Missing Variables', () => {
      it('should return empty string for missing variables', () => {
        const template = 'Value: {{lead.custom.nonexistent}}';
        const result = InterpolationService.interpolate(template, fullContext);
        expect(result).toBe('Value: ');
      });

      it('should return empty string for missing context sections', () => {
        const template = '{{lead.email}}';
        const result = InterpolationService.interpolate(template, {});
        expect(result).toBe('');
      });

      it('should handle missing intermediate paths', () => {
        const template = '{{lead.custom.deep.nested.value}}';
        const result = InterpolationService.interpolate(template, fullContext);
        expect(result).toBe('');
      });

      it('should use custom missing value when specified', () => {
        const template = 'Value: {{lead.custom.missing}}';
        const result = InterpolationService.interpolate(template, fullContext, {
          missingValue: 'N/A',
        });
        expect(result).toBe('Value: N/A');
      });

      it('should preserve unresolved when option is set', () => {
        const template = 'Value: {{lead.custom.missing}}';
        const result = InterpolationService.interpolate(template, fullContext, {
          preserveUnresolved: true,
        });
        expect(result).toBe('Value: {{lead.custom.missing}}');
      });
    });

    describe('Invalid Syntax', () => {
      it('should preserve unclosed braces', () => {
        const template = 'Hello {{lead.email';
        const result = InterpolationService.interpolate(template, fullContext);
        expect(result).toBe('Hello {{lead.email');
      });

      it('should preserve single braces', () => {
        const template = 'Hello {name}';
        const result = InterpolationService.interpolate(template, fullContext);
        expect(result).toBe('Hello {name}');
      });

      it('should preserve empty braces as invalid syntax', () => {
        const template = 'Hello {{}}';
        const result = InterpolationService.interpolate(template, fullContext);
        // Empty braces are invalid syntax - the regex doesn't match empty path
        expect(result).toBe('Hello {{}}');
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty template', () => {
        const result = InterpolationService.interpolate('', fullContext);
        expect(result).toBe('');
      });

      it('should handle template with no variables', () => {
        const template = 'Hello World!';
        const result = InterpolationService.interpolate(template, fullContext);
        expect(result).toBe('Hello World!');
      });

      it('should handle whitespace in variable names', () => {
        const template = '{{ lead.email }}';
        const result = InterpolationService.interpolate(template, fullContext);
        expect(result).toBe('test@example.com');
      });

      it('should handle null values in context', () => {
        const ctx: InterpolationContext = {
          lead: {
            id: '1',
            email: 'test@example.com',
            stage: 'CAPTURED',
            source: null,
            custom: {
              nullValue: null,
            },
          },
        };

        const template = 'Source: {{lead.source}}, Null: {{lead.custom.nullValue}}';
        const result = InterpolationService.interpolate(template, ctx);
        expect(result).toBe('Source: , Null: ');
      });
    });

    describe('Options', () => {
      it('should disable HTML escaping when specified', () => {
        const ctx: InterpolationContext = {
          lead: {
            id: '1',
            email: '<test>@example.com',
            stage: 'CAPTURED',
            source: null,
            custom: {},
          },
        };

        const template = '{{lead.email}}';
        const result = InterpolationService.interpolate(template, ctx, {
          escapeHtml: false,
        });
        expect(result).toBe('<test>@example.com');
      });
    });
  });

  describe('parseTemplate', () => {
    it('should extract variable paths', () => {
      const template = 'Hello {{lead.name}}, your barcode is {{lead.custom.barcode}}';
      const result = InterpolationService.parseTemplate(template);
      
      expect(result.variables).toContain('lead.name');
      expect(result.variables).toContain('lead.custom.barcode');
      expect(result.variables).toHaveLength(2);
    });

    it('should detect raw variables', () => {
      const template = 'Normal: {{var}}, Raw: {{{raw}}}';
      const result = InterpolationService.parseTemplate(template);
      
      expect(result.hasRawVariables).toBe(true);
      expect(result.variables).toContain('var');
      expect(result.variables).toContain('raw');
    });

    it('should not have duplicates', () => {
      const template = '{{lead.email}} and {{lead.email}} again';
      const result = InterpolationService.parseTemplate(template);
      
      expect(result.variables).toHaveLength(1);
      expect(result.variables).toContain('lead.email');
    });

    it('should handle template with no variables', () => {
      const template = 'Hello World!';
      const result = InterpolationService.parseTemplate(template);
      
      expect(result.variables).toHaveLength(0);
      expect(result.hasRawVariables).toBe(false);
    });
  });

  describe('getAvailablePaths', () => {
    it('should return lead paths', () => {
      const paths = InterpolationService.getAvailablePaths({
        lead: {
          id: '1',
          email: 'test@example.com',
          stage: 'CAPTURED',
          source: 'landing',
          custom: {
            barcode: '123',
          },
        },
      });

      expect(paths).toContain('lead.id');
      expect(paths).toContain('lead.email');
      expect(paths).toContain('lead.custom.barcode');
    });

    it('should return workspace paths', () => {
      const paths = InterpolationService.getAvailablePaths({
        workspace: {
          id: '1',
          name: 'Test',
          slug: 'test',
        },
      });

      expect(paths).toContain('workspace.id');
      expect(paths).toContain('workspace.name');
      expect(paths).toContain('workspace.slug');
    });

    it('should return trigger paths', () => {
      const paths = InterpolationService.getAvailablePaths({
        trigger: {
          adapter: 'test',
          operation: 'submit',
          payload: {
            field1: 'value1',
          },
        },
      });

      expect(paths).toContain('trigger.adapter');
      expect(paths).toContain('trigger.operation');
      expect(paths).toContain('trigger.payload.field1');
    });

    it('should return empty array for empty context', () => {
      const paths = InterpolationService.getAvailablePaths({});
      expect(paths).toHaveLength(0);
    });
  });

  describe('validateTemplate', () => {
    it('should return empty array for valid template', () => {
      const template = '{{lead.email}} - {{workspace.name}}';
      const unresolved = InterpolationService.validateTemplate(template, fullContext);
      
      expect(unresolved).toHaveLength(0);
    });

    it('should return unresolved variables', () => {
      const template = '{{lead.email}} - {{nonexistent.path}}';
      const unresolved = InterpolationService.validateTemplate(template, fullContext);
      
      expect(unresolved).toContain('nonexistent.path');
    });

    it('should detect missing custom fields', () => {
      const template = '{{lead.custom.missingField}}';
      const unresolved = InterpolationService.validateTemplate(template, fullContext);
      
      expect(unresolved).toContain('lead.custom.missingField');
    });
  });

  describe('escapeHtml', () => {
    it('should escape all special characters', () => {
      const input = '<script>alert("test" & \'xss\')</script>';
      const result = InterpolationService.escapeHtml(input);
      
      expect(result).toBe('&lt;script&gt;alert(&quot;test&quot; &amp; &#x27;xss&#x27;)&lt;/script&gt;');
    });

    it('should handle empty string', () => {
      expect(InterpolationService.escapeHtml('')).toBe('');
    });

    it('should not double-escape', () => {
      const input = '&amp;';
      const result = InterpolationService.escapeHtml(input);
      expect(result).toBe('&amp;amp;');
    });
  });
});

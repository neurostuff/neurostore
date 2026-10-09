import { EAnalysisType } from 'hooks/projects/Project.types';
import { getCurationSearchPath } from 'pages/CurationImport/CurationSearchPage.helpers';
import { describe, expect, it } from 'vitest';

describe('curationSearchPath', () => {
    it('builds curation search path with dataType query param', () => {
        expect(getCurationSearchPath('pid', EAnalysisType.IBMA)).toBe('/projects/pid/curation/search?dataType=image');
        expect(getCurationSearchPath('pid', EAnalysisType.CBMA)).toBe(
            '/projects/pid/curation/search?dataType=coordinate'
        );
    });
});

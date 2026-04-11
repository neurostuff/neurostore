import { EAnalysisType } from 'hooks/projects/Project.types';
import { SearchDataType } from 'pages/Study/Study.types';
import { describe, expect, it } from 'vitest';
import {
    getCurationSearchPath,
    getDefaultCurationSearchDataType,
} from 'pages/CurationImport/CurationSearchPage.helpers';

describe('curationSearchPath', () => {
    it('maps IBMA to image and CBMA or undefined to coordinate', () => {
        expect(getDefaultCurationSearchDataType(EAnalysisType.IBMA)).toBe(SearchDataType.IMAGE);
        expect(getDefaultCurationSearchDataType(EAnalysisType.CBMA)).toBe(SearchDataType.COORDINATE);
        expect(getDefaultCurationSearchDataType(undefined)).toBe(SearchDataType.COORDINATE);
    });

    it('builds curation search path with dataType query param', () => {
        expect(getCurationSearchPath('pid', EAnalysisType.IBMA)).toBe('/projects/pid/curation/search?dataType=image');
        expect(getCurationSearchPath('pid', EAnalysisType.CBMA)).toBe(
            '/projects/pid/curation/search?dataType=coordinate'
        );
    });
});

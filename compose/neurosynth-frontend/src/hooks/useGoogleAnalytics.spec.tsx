import { routeMapping } from './useGoogleAnalytics';

describe('useGoogleAnalytics', () => {
    test.each`
        path                                                             | expected
        ${'/projects/g7VRaCLw3iZJ/curation'}                             | ${'curation page'}
        ${'/projects/g7VRaCLw3iZJ/curation/import'}                      | ${'curation import page'}
        ${'/projects/g7VRaCLw3iZJ/curation/import?pageOfResults=2'}      | ${'curation import page'}
        ${'/projects/g7VRaCLw3iZJ/extraction'}                           | ${'extraction page'}
        ${'/projects/g7VRaCLw3iZJ/extraction/annotations'}               | ${'annotations page'}
        ${'/projects'}                                                   | ${'projects page'}
        ${'/projects/g7VRaCLw3iZJ/project'}                              | ${'project page'}
        ${'/projects/6zW6TJtzpFjr/meta-analyses'}                        | ${'project meta-analyses page'}
        ${'/projects/98ZZj2vbpySw/meta-analyses/8K6KhGEfTy6H'}           | ${'project meta-analysis page'}
        ${'/projects/new/sleuth'}                                        | ${'sleuth import page'}
        ${'/base-studies'}                                               | ${'base-studies page'}
        ${'/meta-analyses'}                                              | ${'meta-analyses page'}
        ${'/meta-analyses/BdCib6uM3QDX'}                                 | ${'meta-analysis page'}
        ${'/base-studies/FSfE96JVaPuU/5neCyoMwEvrM'}                     | ${'base-study page'}
        ${'/base-studies/FSfE96JVaPuU'}                                  | ${'base-study page'}
        ${'/projects/g7VRaCLw3iZJ/extraction/studies/v7RBrDFEbAC7/edit'} | ${'edit project study page'}
        ${'/projects/g7VRaCLw3iZJ/extraction/studies/v7RBrDFEbAC7'}      | ${'project study page'}
        ${'/user-profile'}                                               | ${'user profile page'}
        ${'/forbidden'}                                                  | ${'forbidden page'}
        ${'/termsandconditions'}                                         | ${'terms and conditions page'}
        ${'/not-found'}                                                  | ${'not found page'}
    `('transforms $path to $expected', ({ path, expected }) => {
        expect(routeMapping(path)).toEqual(expected);
    });
});

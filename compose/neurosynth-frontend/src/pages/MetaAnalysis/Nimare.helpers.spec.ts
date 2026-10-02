import { formatNimareMethodDescription } from './Nimare.helpers';

const mockMethodReferences = `@article{Salo2023,
  title = {NiMARE: Neuroimaging Meta-Analysis Research Environment},
  author = {Salo, Taylor and Yarkoni, Tal and Nichols, Thomas E and Laird, Angela R},
  journal = {Aperture Neuro},
  volume = {3},
  year = {2023}
}
@article{dersimonian1986meta,
  title = {Meta-analysis in clinical trials},
  author = {DerSimonian, Rebecca and Laird, Nan},
  journal = {Controlled Clinical Trials},
  year = {1986}
}
@article{eickhoff2012activation,
  title = {Activation likelihood estimation meta-analysis revisited},
  author = {Eickhoff, Simon B and Bzdok, Danilo and Laird, Angela R},
  journal = {Neuroimage},
  year = {2012}
}`;

describe('formatNimareMethodDescription', () => {
    it('formats \\citep as a parenthetical citation with multiple keys', async () => {
        const { description } = await formatNimareMethodDescription(
            'Estimated with the DerSimonian-Laird method \\citep{dersimonian1986meta,Salo2023}.',
            mockMethodReferences
        );

        expect(description).toBe(
            'Estimated with the DerSimonian-Laird method (DerSimonian & Laird, 1986; Salo et al., 2023).'
        );
    });

    it('formats \\citealt without parentheses and \\cite as a narrative citation', async () => {
        const { description } = await formatNimareMethodDescription(
            'Performed with NiMARE (RRID:SCR_017398; \\citealt{Salo2023}) using the kernel from \\cite{eickhoff2012activation}.',
            mockMethodReferences
        );

        expect(description).toBe(
            'Performed with NiMARE (RRID:SCR_017398; Salo et al., 2023) using the kernel from Eickhoff et al. (2012).'
        );
    });

    it('leaves citation keys missing from the references as the raw key', async () => {
        const { description } = await formatNimareMethodDescription(
            'A method \\citep{unknownKey}.',
            mockMethodReferences
        );

        expect(description).toBe('A method (unknownKey).');
    });

    it('returns the references as an APA bibliography', async () => {
        const { references } = await formatNimareMethodDescription('A method.', mockMethodReferences);

        expect(references).toContain('DerSimonian, R., & Laird, N. (1986). Meta-analysis in clinical trials.');
        expect(references).toContain('Salo, T., Yarkoni, T., Nichols, T. E., & Laird, A. R. (2023).');
    });

    it('returns an empty bibliography when there are no references', async () => {
        const result = await formatNimareMethodDescription('A method \\citep{Salo2023}.', null);

        expect(result).toEqual({ description: 'A method (Salo2023).', references: '' });
    });
});

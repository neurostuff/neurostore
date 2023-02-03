// https://guides.lib.unc.edu/systematic-reviews/write
// https://www.bmj.com/content/372/bmj.n71
// https://www.prisma-statement.org/
// https://docs.google.com/document/d/1pV_JFIXsTIGNbkKpST4nJ0-sl6Fu0Hvo/edit

implement this via reactflow

export interface IPRISMAWorkflow {
    identification: {
        recordsIdentified: {
            databaseName: string;
            numRecords: number;
            type: 'DATABASE' | 'REGISTER';
        }[];
        duplicateRecordsRemoved: number;
        exclusions: {
            exclusionReason: string;
            numRecords: number;
        }[];
    };
    screening: {
        numRecordsToScreen: number; // number of records identified minus number from duplicates removed
        exclusions: {
            // excluded based on title and abstract - not english, not relevant, etc
            exclusionReason: string;
            numRecords: number;
        }[];
        recordsSoughtForRetrieval: number; // number of numRecordsToScreen minus number of excluded records
        recordsNotRetrieved: number; // number of records where user is unable to retrieve full text
    };
    eligibility: {
        recordsAssessedForEligibility: number; // number of recordsSoughtForRetrieval minus recordsNotRetrieved
        exclusions: {
            exclusionReason: string;
            numRecords: number;
        }[];
    };
    included: {
        recordsIncluded: number; // recordsAssessedForEligibility minus number of records excluded during eligibility
    };
}

const prismaExample: IPRISMAWorkflow = {
    identification: {
        recordsIdentified: [
            {
                databaseName: 'PubMed',
                numRecords: 2208,
                type: 'DATABASE',
            },
            {
                databaseName: 'OTHER',
                numRecords: 9,
                type: 'DATABASE',
            },
        ],
        duplicateRecordsRemoved: 15,
        exclusions: [],
    },
    screening: {
        numRecordsToScreen: 2202,
        exclusions: [
            {
                exclusionReason: 'irrelevant',
                numRecords: 2115,
            },
        ],
        recordsSoughtForRetrieval: 87,
        recordsNotRetrieved: 0,
    },
    eligibility: {
        recordsAssessedForEligibility: 87,
        exclusions: [
            {
                exclusionReason: 'out of scope',
                numRecords: 44,
            },
            {
                exclusionReason: 'insufficient details',
                numRecords: 3,
            },
            {
                exclusionReason: 'limited rigor',
                numRecords: 3,
            },
        ],
    },
    included: {
        recordsIncluded: 37,
    },
};

const PrismaComponent: React.FC<{ prisma?: IPRISMAWorkflow }> = (props) => {
    const { prisma = prismaExample } = props;

    return <div>hello hello hello</div>;
};

export default PrismaComponent;

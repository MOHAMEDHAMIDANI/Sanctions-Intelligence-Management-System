import { SanctionedEntityService } from './sanctioned-entity.service';

describe('SanctionedEntityService import/display fallbacks', () => {
  let service: SanctionedEntityService;

  beforeEach(() => {
    service = new SanctionedEntityService(
      {} as any,
      { log: jest.fn() } as any,
      {} as any,
    );
  });

  it('maps a single Name column into fullName and name1', () => {
    const row = (service as any).normalizeImportedRow({
      Name: 'John Doe',
      Nationality: 'DZ',
    });

    expect(row.fullName).toBe('John Doe');
    expect(row.name1).toBe('John Doe');
    expect(row.nationality).toBe('DZ');
  });

  it('falls back to fullName when flattening legacy rows without name1', () => {
    const flattened = (service as any).flattenProfile({
      id: 'entry-1',
      rawData: {
        fullName: 'Jane Doe',
      },
      fullName: 'Jane Doe',
      dateOfBirth: null,
      nationality: null,
      otherInformation: null,
      entityType: 'INDIVIDUAL',
      updatedAt: new Date('2026-04-07T00:00:00.000Z'),
      names: [],
      addresses: [],
      datesOfBirth: [],
      evidenceDocuments: [],
    });

    expect(flattened.name1).toBe('Jane Doe');
    expect(flattened.fullName).toBe('Jane Doe');
  });

  it('maps French Excel headers used by CTRF exports', () => {
    const row = (service as any).normalizeImportedRow({
      TYPE_CLIENT: 'PHYSIQUE',
      EMETTEUR: 'CTRF',
      ID_REQUISITION: '472/MF/CTRF/PT/2018',
      DATE_REQUISITION: '20181115',
      FULL_NAME: 'FERAHNA AMOR',
      OPERATION: 'GEL',
      DATE_NAISSANCE: '19550425',
      LIEU_NAISSANCE: 'BATNA',
    });

    expect(row.name1).toBe('FERAHNA AMOR');
    expect(row.groupType).toBe('PHYSIQUE');
    expect(row.regime).toBe('GEL');
    expect(row.dob).toBe('1955-04-25');
    expect(row.townOfBirth).toBe('BATNA');
    expect(row.listedOn).toBe('2018-11-15');
    expect(row.otherInfo).toContain('Emitter: CTRF');
    expect(row.otherInfo).toContain('Requisition ID: 472/MF/CTRF/PT/2018');
  });
});

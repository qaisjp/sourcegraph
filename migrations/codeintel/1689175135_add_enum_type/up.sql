DROP TYPE IF EXISTS SymbolNameSegmentType;

CREATE TYPE SymbolNameSegmentType AS ENUM (
    'SCHEME',
    'PACKAGE_MANAGER',
    'PACKAGE_NAME',
    'PACKAGE_VERSION',
    'DESCRIPTOR_NAMESPACE',
    'DESCRIPTOR_SUFFIX',
    'DESCRIPTOR_SUFFIX_FUZZY'
);

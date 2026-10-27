-- ORÉA École — schema_v9 (Paquet E) : report des impayés vers la nouvelle année
-- Un frais « Arriérés » peut maintenant être rattaché à UN élève précis.
alter table extra_fees add column if not exists student_id uuid references students on delete cascade;
create index if not exists extra_fees_student_ix on extra_fees(student_id);




export const PROJECT_FOR_USER = `
  SELECT
    p.id                AS project_id,
    p.organization_id   AS organization_id,
    p.name              AS name,
    p.status            AS status,
    p.visibility        AS visibility,
    p.revision          AS revision,
    p.updated_at        AS updated_at,
    o.status            AS organization_status,
    m.id                AS membership_id,
    m.status            AS membership_status,
    m.org_role          AS org_role,
    m.access_profile_id AS member_profile_id,
    (SELECT pm.role
       FROM project_memberships pm
      WHERE pm.project_id = p.id AND pm.user_id = ?1)            AS direct_role,
    (SELECT pta.role
       FROM project_team_access pta
       JOIN team_memberships tm
         ON tm.team_id = pta.team_id AND tm.user_id = ?1
      WHERE pta.project_id = p.id
      ORDER BY CASE pta.role
                 WHEN 'owner'       THEN 4
                 WHEN 'editor'      THEN 3
                 WHEN 'contributor' THEN 2
                 ELSE 1 END DESC
      LIMIT 1)                                                    AS team_role
  FROM projects p
  JOIN organizations o
    ON o.id = p.organization_id
  JOIN organization_memberships m
    ON m.organization_id = p.organization_id
   AND m.user_id = ?1
  WHERE p.id = ?2
    AND p.status <> 'deleted'
`;


export const CAPABILITIES_FOR_USER = `
  SELECT apc.capability_id AS capability_id, 'profile' AS source
    FROM organization_memberships m
    JOIN access_profile_capabilities apc
      ON apc.profile_id = m.access_profile_id
   WHERE m.user_id = ?1
     AND m.organization_id = ?2
     AND m.status = 'active'
  UNION
  SELECT apc.capability_id AS capability_id, 'team' AS source
    FROM organization_memberships m
    JOIN team_memberships tm
      ON tm.user_id = m.user_id
    JOIN teams t
      ON t.id = tm.team_id
     AND t.organization_id = m.organization_id
    JOIN access_profile_capabilities apc
      ON apc.profile_id = t.access_profile_id
   WHERE m.user_id = ?1
     AND m.organization_id = ?2
     AND m.status = 'active'
`;


export const CAPABILITY_OVERRIDES_FOR_USER = `
  SELECT o.capability_id AS capability_id, o.effect AS effect
    FROM membership_capability_overrides o
    JOIN organization_memberships m
      ON m.id = o.membership_id
   WHERE m.user_id = ?1
     AND m.organization_id = ?2
     AND m.status = 'active'
`;


export const PROJECTS_FOR_USER = `
  SELECT DISTINCT
         p.id, p.organization_id, p.name, p.description, p.status,
         p.visibility, p.updated_at, p.created_at, p.revision
    FROM projects p
    JOIN organization_memberships m
      ON m.organization_id = p.organization_id
     AND m.user_id = ?1
     AND m.status = 'active'
    LEFT JOIN project_memberships pm
      ON pm.project_id = p.id AND pm.user_id = ?1
    LEFT JOIN project_team_access pta
      ON pta.project_id = p.id
     AND pta.team_id IN (SELECT team_id FROM team_memberships WHERE user_id = ?1)
   WHERE p.organization_id = ?2
     AND p.status = 'active'
     AND (pm.user_id IS NOT NULL
          OR pta.team_id IS NOT NULL
          OR p.visibility = 'organization')
   ORDER BY p.updated_at DESC
`;


export const ARTIFACTS_FOR_USER = `
  SELECT a.id, a.project_id, a.type, a.title, a.body, a.status,
         a.created_by, a.assigned_to, a.created_at, a.updated_at, a.revision
    FROM artifacts a
    JOIN projects p
      ON p.id = a.project_id
     AND p.status <> 'deleted'
    JOIN organization_memberships m
      ON m.organization_id = p.organization_id
     AND m.user_id = ?1
     AND m.status = 'active'
    LEFT JOIN project_memberships pm
      ON pm.project_id = p.id AND pm.user_id = ?1
    LEFT JOIN project_team_access pta
      ON pta.project_id = p.id
     AND pta.team_id IN (SELECT team_id FROM team_memberships WHERE user_id = ?1)
   WHERE a.project_id = ?2
     AND a.status = 'active'
     AND (pm.user_id IS NOT NULL
          OR pta.team_id IS NOT NULL
          OR p.visibility = 'organization')
     AND (?3 = '' OR a.type = ?3)
   ORDER BY a.updated_at DESC
`;


export const ARTIFACT_FOR_USER = `
  SELECT a.id, a.project_id, a.type, a.title, a.body, a.status,
         a.created_by, a.assigned_to, a.created_at, a.updated_at, a.revision,
         p.organization_id
    FROM artifacts a
    JOIN projects p
      ON p.id = a.project_id
     AND p.status <> 'deleted'
    JOIN organization_memberships m
      ON m.organization_id = p.organization_id
     AND m.user_id = ?1
     AND m.status = 'active'
    LEFT JOIN project_memberships pm
      ON pm.project_id = p.id AND pm.user_id = ?1
    LEFT JOIN project_team_access pta
      ON pta.project_id = p.id
     AND pta.team_id IN (SELECT team_id FROM team_memberships WHERE user_id = ?1)
   WHERE a.id = ?2
     AND (pm.user_id IS NOT NULL
          OR pta.team_id IS NOT NULL
          OR p.visibility = 'organization')
`;


export const DATASET_VERSION_FOR_USER = `
  SELECT dv.id, dv.dataset_id, dv.version_no, dv.r2_key, dv.byte_size,
         dv.checksum_sha256, dv.content_type, dv.original_filename,
         d.project_id, p.organization_id
    FROM dataset_versions dv
    JOIN datasets d  ON d.id = dv.dataset_id
    JOIN projects p  ON p.id = d.project_id AND p.status <> 'deleted'
    JOIN organization_memberships m
      ON m.organization_id = p.organization_id
     AND m.user_id = ?1
     AND m.status = 'active'
    LEFT JOIN project_memberships pm
      ON pm.project_id = p.id AND pm.user_id = ?1
    LEFT JOIN project_team_access pta
      ON pta.project_id = p.id
     AND pta.team_id IN (SELECT team_id FROM team_memberships WHERE user_id = ?1)
   WHERE dv.id = ?2
     AND (pm.user_id IS NOT NULL
          OR pta.team_id IS NOT NULL
          OR p.visibility = 'organization')
`;


export const SEARCH_FOR_USER = `
  SELECT a.id, a.project_id, a.type, a.title, a.updated_at, p.name AS project_name
    FROM artifacts a
    JOIN projects p
      ON p.id = a.project_id AND p.status = 'active'
    JOIN organization_memberships m
      ON m.organization_id = p.organization_id
     AND m.user_id = ?1
     AND m.status = 'active'
    LEFT JOIN project_memberships pm
      ON pm.project_id = p.id AND pm.user_id = ?1
    LEFT JOIN project_team_access pta
      ON pta.project_id = p.id
     AND pta.team_id IN (SELECT team_id FROM team_memberships WHERE user_id = ?1)
   WHERE p.organization_id = ?2
     AND a.status = 'active'
     AND (pm.user_id IS NOT NULL
          OR pta.team_id IS NOT NULL
          OR p.visibility = 'organization')
     AND LOWER(a.title) LIKE ?3
   ORDER BY a.updated_at DESC
   LIMIT 50
`;


export const ADMINISTRATORS = `
  SELECT m.user_id, m.status, m.org_role, u.email
    FROM organization_memberships m
    JOIN users u ON u.id = m.user_id
   WHERE m.organization_id = ?1
     AND m.org_role = 'administrator'
     AND m.status = 'active'
`;


export const SESSION_BY_HASH = `
  SELECT s.id AS session_id, s.user_id, s.expires_at,
         u.status AS user_status, u.email, u.display_name
    FROM sessions s
    JOIN users u ON u.id = s.user_id
   WHERE s.token_hash = ?1
     AND s.revoked_at IS NULL
     AND s.expires_at > ?2
`;

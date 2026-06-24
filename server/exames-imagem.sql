SELECT
    x.*,

    CASE
        WHEN x.dt_procedimento_realizado IS NOT NULL
            THEN x.dt_procedimento_realizado

        WHEN x.hr_inicio IS NOT NULL
            THEN x.hr_inicio

        ELSE NULL
    END AS dt_evento_exame,

    CASE
        WHEN x.cd_convenio IN (
            41,5,47,17,21,23,25,37,42,12
        )
        THEN 'AUTORIZADO'

        WHEN x.cd_convenio IN (
            14,31,13,16,32,8,54,33,19,34,22,24,26,28,30,55,38
        )
        THEN
            CASE
                WHEN x.nr_seq_autorizacao = 1
                    THEN 'AUTORIZADO'

                WHEN x.nr_seq_autorizacao IS NULL
                    THEN 'SEM AUTORIZAÇÃO INICIADA'

                ELSE 'PENDENTE DE AUTORIZAÇÃO'
            END

        ELSE 'VALIDAR CONVÊNIO'
    END AS status_autorizacao,

    CASE
        WHEN x.dt_procedimento_realizado IS NOT NULL
            THEN 'EXAME REALIZADO'

        WHEN x.dt_agenda IS NOT NULL
             AND x.ie_status_agenda = 'E'
            THEN 'AGENDAMENTO REALIZADO'

        WHEN x.dt_agenda IS NOT NULL
             AND TRUNC(x.dt_agenda) < TRUNC(SYSDATE)
             AND NVL(x.ie_status_agenda, 'X') <> 'E'
            THEN 'AGENDAMENTO NÃO REALIZADO'

        WHEN x.dt_agenda IS NOT NULL
             AND TRUNC(x.dt_agenda) >= TRUNC(SYSDATE)
            THEN 'AGENDADO'

        WHEN x.dt_agenda IS NULL
            THEN 'SEM AGENDAMENTO'

        ELSE 'VALIDAR AGENDAMENTO'
    END AS status_agendamento

FROM (
    SELECT
        un.cd_setor_atendimento,
        st.ds_setor_atendimento setor,
        un.cd_unidade_basica leito,
        un.nr_atendimento,
        ag.dt_agenda,
        ap.cd_pessoa_fisica,
        tasy.obter_nome_paciente(un.nr_atendimento) paciente,
        tasy.obter_convenio_atendimento(ap.nr_atendimento) cd_convenio,
        tasy.obter_desc_convenio(tasy.obter_convenio_atendimento(ap.nr_atendimento)) ds_convenio,
        pm.nr_prescricao,
        pc.cd_procedimento,
        pro.cd_tipo_procedimento,
        pro.ds_procedimento,
        tasy.obter_desc_proc_interno(pc.nr_seq_proc_interno) ds_procedimento_interno,
        pc.nr_seq_proc_interno,
        ag.cd_agenda,
        tasy.obter_desc_agenda(ag.cd_agenda) ds_agenda,
        pm.dt_prescricao,
        ag.hr_inicio,
        ag.ie_status_agenda,
        tasy.obter_valor_dominio(83, ag.ie_status_agenda) ds_status_agenda,

        ROW_NUMBER() OVER (
            PARTITION BY
                pc.nr_prescricao,
                pc.nr_seq_proc_interno,
                ap.cd_pessoa_fisica
            ORDER BY
                ag.dt_agenda DESC NULLS LAST,
                ag.hr_inicio DESC NULLS LAST
        ) rn,

        CASE
            WHEN EXISTS (
                SELECT 1
                FROM tasy.autorizacao_convenio aut
                WHERE aut.nr_prescricao = pm.nr_prescricao
                  AND aut.nr_seq_estagio = 1
            )
            THEN 'SIM'
            ELSE 'NÃO'
        END AS possui_autorizacao,

        (
            SELECT MAX(aut.nr_seq_estagio)
            FROM tasy.autorizacao_convenio aut
            WHERE aut.nr_prescricao = pm.nr_prescricao
        ) AS nr_seq_autorizacao,

        (
            SELECT MAX(pp.dt_procedimento)
            FROM tasy.procedimento_paciente pp
            WHERE pp.nr_prescricao = pm.nr_prescricao
              AND pp.nr_seq_proc_interno = pc.nr_seq_proc_interno
              AND pp.cd_procedimento = pc.cd_procedimento
        ) AS dt_procedimento_realizado

    FROM tasy.unidade_atendimento un

    INNER JOIN tasy.setor_atendimento st
        ON st.cd_setor_atendimento = un.cd_setor_atendimento

    INNER JOIN tasy.atendimento_paciente ap
        ON ap.nr_atendimento = un.nr_atendimento

    INNER JOIN tasy.prescr_medica pm
        ON pm.nr_atendimento = un.nr_atendimento
       AND pm.dt_validade_prescr >= TRUNC(SYSDATE, 'MM')
       AND pm.dt_validade_prescr < ADD_MONTHS(TRUNC(SYSDATE, 'MM'), 1)

    INNER JOIN tasy.prescr_procedimento pc
        ON pc.nr_prescricao = pm.nr_prescricao

    INNER JOIN tasy.procedimento pro
        ON pro.cd_procedimento = pc.cd_procedimento
       AND pro.cd_tipo_procedimento IN (2,3,12,87,4,30,94)

    LEFT JOIN tasy.agenda_paciente ag
        ON ag.cd_pessoa_fisica = ap.cd_pessoa_fisica
       AND ag.cd_procedimento = pc.cd_procedimento
       AND ag.cd_pessoa_fisica IS NOT NULL
       AND ag.cd_agenda IN (
            510,753,511, -- Exames CDI

            771,737,420,857,859,867,603,
            862,860,621,881,871,1162,870,861,1082,418,419, -- Exames Cardiologia

            214,355  -- Exames Centro Médico
       )
       AND ag.ie_status_agenda <> 'C'
       AND TRUNC(ag.dt_agenda) >= TRUNC(pm.dt_prescricao)
       AND TRUNC(ag.dt_agenda) <= TRUNC(pm.dt_prescricao + 30)

    WHERE un.nr_atendimento IS NOT NULL
) x

WHERE x.rn = 1

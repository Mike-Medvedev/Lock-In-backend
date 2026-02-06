-- Custom SQL migration file, put your code below! --

create or replace function process_commitment_forfeits()
returns void
language plpgsql
as $$
begin
    update commitments c
    set status = 'forfeited'
    from (
        select 
            ac.id as commitment_id,
            fl.value as freq_int,
            (ac.start_date::date + (((current_date - ac.start_date::date) / 7) * 7 + 6))::date as week_end,
            count(distinct cs.id) filter (
                where cs.completed_at is not null and cs.fraud_detected = false
            ) as completed_this_week,
            exists (
                select 1 from commitment_sessions 
                where commitment_id = ac.id 
                and counting_day = current_date 
                and completed_at is not null 
                and fraud_detected = false
            ) as done_today
        from commitments ac
        -- Join to your lookup table to get the numeric value
        join frequency_lookup fl on ac.frequency = fl.frequency
        left join commitment_sessions cs on cs.commitment_id = ac.id
            and cs.counting_day between 
                (ac.start_date::date + (((current_date - ac.start_date::date) / 7) * 7))::date 
                and (ac.start_date::date + (((current_date - ac.start_date::date) / 7) * 7 + 6))::date
        where ac.status = 'active'
        group by ac.id, fl.value, ac.start_date
    ) s
    where c.id = s.commitment_id
    and (s.freq_int - s.completed_this_week) > (s.week_end - current_date + (case when s.done_today then 0 else 1 end));
end;
$$;
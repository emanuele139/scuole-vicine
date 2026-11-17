#!/usr/bin/env python3
"""Apply validated nursery research, preserving the preschool data and stable IDs."""
from nursery_research import RESEARCH, merge_nursery_research, publish_nursery_research, update_inventory_report
from school_research import read_json

schools, report = merge_nursery_research(read_json(RESEARCH / 'catalog-before.json'))
publish_nursery_research(schools, report)
update_inventory_report(schools, report)
print({key: report[key] for key in ('catalogTotal', 'reviewed', 'schoolSpecificDetails', 'officialLinks', 'events', 'numericCostRecords')})

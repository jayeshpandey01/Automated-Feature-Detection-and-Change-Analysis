import json

d = json.load(open('output/latest_full_dataset.json'))
glaciers = d['glaciers']
print(f'Total: {len(glaciers)} glaciers processed\n')

for g in glaciers[:5]:
    ca = g.get('change_analysis', {})
    ai = g.get('ai_analysis', {})
    name = g.get('name', 'Unknown')
    region = g.get('region', '')
    area = g.get('area_km2', 0)
    status = ca.get('change_status', 'N/A')
    risk = ca.get('risk_level', 'N/A')
    rate = ca.get('annual_rate', 0)
    conf = ai.get('confidence', 'N/A')
    
    print(f"{name} ({region})")
    print(f"  Area   : {area} km2")
    print(f"  Status : {status}")
    print(f"  Risk   : {risk}")
    print(f"  Rate   : {rate}%/yr")
    print(f"  AI Conf: {conf}")
    print()

import copy
import json
import unittest
from pathlib import Path
from validate_contract import validate


class StackBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.contract = json.loads((Path(__file__).resolve().parents[2] /
                                    'deploy/observability/stack-contract.json').read_text())

    def test_approved_contract(self):
        self.assertEqual(validate(self.contract), [])

    def test_canonical_repository_owner_is_accepted(self):
        changed = copy.deepcopy(self.contract)
        changed['repository'] = 'appolon1908/Breero.com'
        for component in changed['components']:
            component['repository'] = component['repository'].replace(
                'appolon1908-hue/', 'appolon1908/'
            )
        self.assertEqual(validate(changed), [])

    def test_retired_top_level_owner_is_rejected(self):
        self.contract['repository'] = 'appolon1908-hue/Breero.com'
        self.assertTrue(validate(self.contract))

    def test_every_component_is_denied_odoo_writes(self):
        for component in self.contract['components']:
            with self.subTest(component=component['repository']):
                changed = copy.deepcopy(self.contract)
                changed['flows'].append({'source': component['repository'].split('/')[1],
                                         'target': 'Odoo', 'signal': 'business_write'})
                self.assertTrue(validate(changed))

    def test_renamed_signal_cannot_hide_direct_odoo_access(self):
        self.contract['flows'].append({'source': 'Codestra-Grafana-',
                                       'target': 'Odoo', 'signal': 'query'})
        self.assertTrue(validate(self.contract))

    def test_removing_middleware_route_is_rejected(self):
        self.contract['flows'] = [e for e in self.contract['flows']
                                  if e['source'] != 'Codestra-Alertmanager']
        self.assertTrue(validate(self.contract))

    def test_credentials_cannot_be_shared_with_collectors(self):
        self.contract['secrets']['odoo_credentials_consumers'].append('Codestra-Alloy')
        self.assertTrue(validate(self.contract))

    def test_writable_analytics_is_rejected(self):
        self.contract['analytics']['data_access'] = 'read_write'
        self.assertTrue(validate(self.contract))

    def test_missing_or_duplicate_repository_is_rejected(self):
        self.contract['components'][-1] = self.contract['components'][0]
        self.assertTrue(validate(self.contract))


if __name__ == '__main__':
    unittest.main()

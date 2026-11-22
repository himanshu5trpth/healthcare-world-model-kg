import unittest
from prepare_web import source_link, validate_graph


class PublicSnapshotTests(unittest.TestCase):
    def test_doi_and_existing_source_links(self):
        self.assertEqual(source_link('10.1007/example'), 'https://doi.org/10.1007/example')
        self.assertEqual(source_link('https://arxiv.org/abs/1234.5678'), 'https://arxiv.org/abs/1234.5678')
        self.assertEqual(source_link('javascript:alert(1)'), '')
        self.assertEqual(source_link('Not reported'), '')
        self.assertEqual(source_link('https://user:secret@example.org/a'), '')

    def test_dangling_and_duplicate_ids_fail(self):
        with self.assertRaises(ValueError):
            validate_graph([{'id': 'a'}, {'id': 'a'}], [])
        with self.assertRaises(ValueError):
            validate_graph([{'id': 'a'}], [{'subject_id': 'a', 'object_id': 'b'}])
        validate_graph([{'id': 'a'}, {'id': 'b'}], [{'subject_id': 'a', 'object_id': 'b'}])


if __name__ == '__main__':
    unittest.main()

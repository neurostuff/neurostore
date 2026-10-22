"""A reviewer's typed ops applied to one paper's study_schema documents, in two layers.

``core`` applies and validates ops on plain documents and touches no database or web framework;
``app`` loads and stores reviews through a session. Both layers raise the errors of ``errors``.
"""

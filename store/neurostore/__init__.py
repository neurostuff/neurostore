import os
import sys
import warnings

os.environ['SQLALCHEMY_WARN_20'] = 'yes'
if not sys.warnoptions:
    warnings.simplefilter("default")

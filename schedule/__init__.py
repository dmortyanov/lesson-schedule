# Настройка PyMySQL для работы с MySQL
try:
    import pymysql
    pymysql.install_as_MySQLdb()
except ImportError:
    # Если PyMySQL не установлен, используется mysqlclient
    pass

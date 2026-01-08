# S3 Bucket for Glue Catalog data
resource "aws_s3_bucket" "glue_data" {
  bucket = "catalog-agents-glue-data-${random_id.bucket_suffix.hex}"

  tags = {
    Name = "catalog-agents-glue-data"
  }
}

resource "aws_s3_bucket_versioning" "glue_data" {
  bucket = aws_s3_bucket.glue_data.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "glue_data" {
  bucket = aws_s3_bucket.glue_data.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "random_id" "bucket_suffix" {
  byte_length = 4
}

# Glue Database - Customer Data
resource "aws_glue_catalog_database" "customer_db" {
  name        = "customer_database"
  description = "Customer data catalog for demo purposes"

  tags = {
    Name        = "customer-database"
    DataDomain  = "customer"
    Environment = var.environment
  }
}

# Glue Database - Sales Data
resource "aws_glue_catalog_database" "sales_db" {
  name        = "sales_database"
  description = "Sales data catalog for demo purposes"

  tags = {
    Name        = "sales-database"
    DataDomain  = "sales"
    Environment = var.environment
  }
}

# Glue Database - Analytics
resource "aws_glue_catalog_database" "analytics_db" {
  name        = "analytics_database"
  description = "Analytics data catalog for demo purposes"

  tags = {
    Name        = "analytics-database"
    DataDomain  = "analytics"
    Environment = var.environment
  }
}

# Sample Glue Table - Customer Profile
resource "aws_glue_catalog_table" "customer_profile" {
  name          = "customer_profile"
  database_name = aws_glue_catalog_database.customer_db.name
  description   = "Customer profile information"

  table_type = "EXTERNAL_TABLE"

  parameters = {
    "classification" = "parquet"
  }

  storage_descriptor {
    location      = "s3://${aws_s3_bucket.glue_data.bucket}/customer/profile/"
    input_format  = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat"
    output_format = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat"

    ser_de_info {
      serialization_library = "org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe"
    }

    columns {
      name = "customer_id"
      type = "bigint"
    }

    columns {
      name = "first_name"
      type = "string"
    }

    columns {
      name = "last_name"
      type = "string"
    }

    columns {
      name = "email"
      type = "string"
    }

    columns {
      name = "created_timestamp"
      type = "timestamp"
    }
  }


}

# Sample Glue Table - Customer Orders
resource "aws_glue_catalog_table" "customer_orders" {
  name          = "customer_orders"
  database_name = aws_glue_catalog_database.sales_db.name
  description   = "Customer order transactions"

  table_type = "EXTERNAL_TABLE"

  parameters = {
    "classification" = "parquet"
  }

  storage_descriptor {
    location      = "s3://${aws_s3_bucket.glue_data.bucket}/sales/orders/"
    input_format  = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat"
    output_format = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat"

    ser_de_info {
      serialization_library = "org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe"
    }

    columns {
      name = "order_id"
      type = "bigint"
    }

    columns {
      name = "customer_id"
      type = "bigint"
    }

    columns {
      name = "product_name"
      type = "string"
    }

    columns {
      name = "quantity"
      type = "int"
    }

    columns {
      name = "price"
      type = "decimal(10,2)"
    }

    columns {
      name = "order_timestamp"
      type = "timestamp"
    }
  }


}

# Sample Glue Table - Analytics Summary
resource "aws_glue_catalog_table" "analytics_summary" {
  name          = "daily_sales_summary"
  database_name = aws_glue_catalog_database.analytics_db.name
  description   = "Daily sales analytics summary"

  table_type = "EXTERNAL_TABLE"

  parameters = {
    "classification" = "parquet"
  }

  storage_descriptor {
    location      = "s3://${aws_s3_bucket.glue_data.bucket}/analytics/daily_summary/"
    input_format  = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat"
    output_format = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat"

    ser_de_info {
      serialization_library = "org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe"
    }

    columns {
      name = "date"
      type = "date"
    }

    columns {
      name = "total_orders"
      type = "bigint"
    }

    columns {
      name = "total_revenue"
      type = "decimal(15,2)"
    }

    columns {
      name = "unique_customers"
      type = "bigint"
    }

    columns {
      name = "created_timestamp"
      type = "timestamp"
    }
  }


}

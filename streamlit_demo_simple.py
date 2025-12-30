import streamlit as st
import os
from agents.glue_catalog_agent import glue_agent
from agents.unity_catalog_agent import unity_agent

st.title("🗄️ Catalog Agents Demo")
st.write("Query both AWS Glue and Unity catalogs deployed on AWS")

# Configuration
st.sidebar.header("Configuration")
unity_url = st.sidebar.text_input("Unity Catalog URL", value="http://catalog-agents-alb-1234567890.us-east-1.elb.amazonaws.com/api/2.1/unity-catalog")
aws_region = st.sidebar.selectbox("AWS Region", ["us-east-1", "us-west-2", "eu-west-1"], index=0)

# Set environment variables
os.environ["AWS_DEFAULT_REGION"] = aws_region

# Catalog selection
catalog_choice = st.selectbox("Select Catalog", ["AWS Glue Catalog", "Unity Catalog", "Both Catalogs"])

# Query input
query = st.text_area("Enter your query:", 
                    placeholder="Examples:\n- List all databases\n- Show tables in database_name\n- Find tables with 'customer' in the name\n- Get details for table_name")

if st.button("Execute Query"):
    if not query.strip():
        st.error("Please enter a query")
    else:
        with st.spinner("Executing query..."):
            try:
                if catalog_choice == "AWS Glue Catalog":
                    st.subheader("🔍 AWS Glue Catalog Results")
                    result = glue_agent.run(query)
                    st.json(result.data)
                    
                elif catalog_choice == "Unity Catalog":
                    st.subheader("🔍 Unity Catalog Results")
                    # Update Unity agent URL
                    unity_agent.tools[0].unity_catalog_url = unity_url
                    result = unity_agent.run(query)
                    st.json(result.data)
                    
                else:  # Both Catalogs
                    col1, col2 = st.columns(2)
                    
                    with col1:
                        st.subheader("🔍 AWS Glue Catalog")
                        try:
                            glue_result = glue_agent.run(query)
                            st.json(glue_result.data)
                        except Exception as e:
                            st.error(f"Glue error: {str(e)}")
                    
                    with col2:
                        st.subheader("🔍 Unity Catalog")
                        try:
                            unity_agent.tools[0].unity_catalog_url = unity_url
                            unity_result = unity_agent.run(query)
                            st.json(unity_result.data)
                        except Exception as e:
                            st.error(f"Unity error: {str(e)}")
                            
            except Exception as e:
                st.error(f"Error executing query: {str(e)}")

# Sample queries
st.subheader("📝 Sample Queries")
sample_queries = [
    "List all databases",
    "Show tables in customer_database", 
    "Find tables with 'customer' in the name",
    "Get details for customer_profile table in customer_database",
    "Find tables with columns containing 'timestamp'"
]

for sample in sample_queries:
    if st.button(f"Try: {sample}", key=sample):
        st.text_area("Query:", value=sample, key=f"sample_{sample}")

# Infrastructure info
st.subheader("🏗️ Deployed Infrastructure")
st.info("""
**AWS Resources Deployed:**
- ECS Fargate cluster running Unity Catalog
- RDS PostgreSQL for Unity Catalog metadata  
- AWS Glue Catalog with sample databases and tables
- Application Load Balancer for web access
- All resources tagged for FIS chaos experiments

**Available Databases:**
- customer_database (Glue)
- sales_database (Glue) 
- analytics_database (Glue)
- Unity catalog databases (if configured)
""")
